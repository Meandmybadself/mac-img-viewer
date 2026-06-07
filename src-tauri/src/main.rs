#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cache;
mod model;
mod scan;
mod settings;
mod thumbs;

use settings::Settings;
use tauri::Manager;

/// Scan a folder (non-recursive) for supported media.
#[tauri::command]
async fn scan_folder(path: String) -> Result<Vec<model::MediaItem>, String> {
    tauri::async_runtime::spawn_blocking(move || scan::scan_folder(&path))
        .await
        .map_err(|e| e.to_string())?
}

/// Ensure a cached thumbnail exists and return its absolute path.
#[tauri::command]
async fn get_thumbnail(app: tauri::AppHandle, path: String, max: u32) -> Result<String, String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let out = tauri::async_runtime::spawn_blocking(move || thumbs::generate(&path, max, &cache_dir))
        .await
        .map_err(|e| e.to_string())??;
    Ok(out.to_string_lossy().into_owned())
}

/// Reveal a file in Finder (selecting it).
#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Load persisted UI settings (last folder, recent folders).
#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> Settings {
    settings::load(&app)
}

/// Persist UI settings.
#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    settings::save(&app, &settings)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_folder,
            get_thumbnail,
            reveal_in_finder,
            load_settings,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
