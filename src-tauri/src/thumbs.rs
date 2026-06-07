use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::UNIX_EPOCH;

use image::DynamicImage;

use crate::cache;
use crate::model::kind_for;

/// Ensure a thumbnail JPEG exists in the cache for `src`, returning its path.
/// Images are decoded in-process; videos get a poster frame from macOS Quick Look.
pub fn generate(src: &str, max: u32, cache_dir: &Path) -> Result<PathBuf, String> {
    let meta = fs::metadata(src).map_err(|e| e.to_string())?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let key = cache::key_for(src, mtime, meta.len(), max);
    let thumbs_dir = cache_dir.join("thumbnails");
    cache::ensure_dir(&thumbs_dir).map_err(|e| e.to_string())?;
    let out = thumbs_dir.join(format!("{key}.jpg"));
    if out.exists() {
        return Ok(out);
    }

    let ext = Path::new(src)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let kind = kind_for(ext).ok_or_else(|| "unsupported file type".to_string())?;

    let img = if kind == "video" {
        video_poster(src, max)?
    } else {
        image::open(src).map_err(|e| e.to_string())?
    };

    // Downscale and normalize to RGB JPEG (drops alpha so PNG/WebP encode cleanly).
    let thumb = img.thumbnail(max, max).to_rgb8();
    thumb
        .save_with_format(&out, image::ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    Ok(out)
}

/// Extract a poster frame for a video using `qlmanage`, which natively handles
/// mov/mp4 and every other format Quick Look knows.
fn video_poster(src: &str, max: u32) -> Result<DynamicImage, String> {
    let tmp = std::env::temp_dir().join(format!("imgviewer-ql-{}", unique()));
    fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;

    let output = Command::new("qlmanage")
        .args(["-t", "-s", &max.to_string(), "-o"])
        .arg(&tmp)
        .arg(src)
        .output()
        .map_err(|e| e.to_string());

    // qlmanage writes "<basename>.png" into the output dir; pick up whatever it made.
    let png = fs::read_dir(&tmp).ok().and_then(|rd| {
        rd.flatten()
            .map(|e| e.path())
            .find(|p| p.extension().map(|x| x == "png").unwrap_or(false))
    });

    let result = match png {
        Some(p) => image::open(&p).map_err(|e| e.to_string()),
        None => Err(format!(
            "no poster frame produced ({:?})",
            output.map(|o| o.status)
        )),
    };

    let _ = fs::remove_dir_all(&tmp);
    result
}

/// Process-unique suffix for temp dirs (avoids time/random dependencies).
fn unique() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    format!(
        "{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}
