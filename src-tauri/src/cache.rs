use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;

/// Stable cache key for a thumbnail. Includes mtime + size so the cache
/// self-invalidates when the underlying file changes.
pub fn key_for(path: &str, mtime: u64, size: u64, max: u32) -> String {
    let mut h = DefaultHasher::new();
    path.hash(&mut h);
    mtime.hash(&mut h);
    size.hash(&mut h);
    max.hash(&mut h);
    format!("{:016x}", h.finish())
}

pub fn ensure_dir(dir: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)
}
