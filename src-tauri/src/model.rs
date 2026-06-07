use serde::Serialize;

/// One media file surfaced to the frontend.
#[derive(Serialize, Clone)]
pub struct MediaItem {
    pub path: String,
    pub name: String,
    pub kind: String, // "image" | "video"
    pub size: u64,
    pub modified: u64, // milliseconds since epoch
}

const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp"];
const VIDEO_EXTS: &[&str] = &["mov", "mp4", "m4v"];

/// Classify a file extension; `None` means "not a supported media file".
pub fn kind_for(ext: &str) -> Option<&'static str> {
    let e = ext.to_ascii_lowercase();
    if IMAGE_EXTS.contains(&e.as_str()) {
        Some("image")
    } else if VIDEO_EXTS.contains(&e.as_str()) {
        Some("video")
    } else {
        None
    }
}
