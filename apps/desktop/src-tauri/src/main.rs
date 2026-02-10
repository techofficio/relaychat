#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

const WORKSPACE_STATE_FILE: &str = "workspace_state.json";

fn workspace_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
    fs::create_dir_all(&base_dir)
        .map_err(|error| format!("failed to create app data directory: {error}"))?;
    Ok(base_dir.join(WORKSPACE_STATE_FILE))
}

#[tauri::command]
fn load_workspace_state(app: AppHandle) -> Result<Option<String>, String> {
    let path = workspace_state_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(path).map_err(|error| format!("failed to read state: {error}"))?;
    Ok(Some(raw))
}

#[tauri::command]
fn save_workspace_state(app: AppHandle, raw: String) -> Result<(), String> {
    let path = workspace_state_path(&app)?;
    fs::write(path, raw).map_err(|error| format!("failed to write state: {error}"))?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_workspace_state,
            save_workspace_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
