use std::fs;
use std::time::UNIX_EPOCH;

use crate::model::{kind_for, MediaItem};

/// List supported media in a single folder (non-recursive).
pub fn scan_folder(path: &str) -> Result<Vec<MediaItem>, String> {
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut out = Vec::new();

    for entry in entries.flatten() {
        let p = entry.path();
        let ext = match p.extension().and_then(|e| e.to_str()) {
            Some(e) => e,
            None => continue,
        };
        let kind = match kind_for(ext) {
            Some(k) => k,
            None => continue,
        };
        let meta = match entry.metadata() {
            Ok(m) if m.is_file() => m,
            _ => continue,
        };
        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        out.push(MediaItem {
            path: p.to_string_lossy().into_owned(),
            name: p
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default()
                .to_string(),
            kind: kind.to_string(),
            size: meta.len(),
            modified,
        });
    }

    Ok(out)
}
