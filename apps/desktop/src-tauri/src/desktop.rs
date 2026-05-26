use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;
use walkdir::WalkDir;

#[derive(Serialize)]
pub struct InstallInfo {
    pub version: String,
    pub install_path: String,
    pub data_path: String,
    pub storage_bytes: u64,
    pub runtime_status: String,
    pub first_launch: bool,
    pub build_date: String,
}

#[derive(Serialize)]
pub struct StorageUsage {
    pub cache_bytes: u64,
    pub data_bytes: u64,
    pub logs_bytes: u64,
    pub total_bytes: u64,
}

fn data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn cache_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_cache_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn dir_size(path: &PathBuf) -> u64 {
    if !path.exists() {
        return 0;
    }
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

#[tauri::command]
pub fn get_install_info(app: tauri::AppHandle) -> InstallInfo {
    let data = data_dir(&app);
    let cache = cache_dir(&app);
    let storage = dir_size(&data) + dir_size(&cache);

    InstallInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        install_path: std::env::current_exe()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        data_path: data.to_string_lossy().to_string(),
        storage_bytes: storage,
        runtime_status: "running".to_string(),
        first_launch: !data.join(".agentic-os").join("settings.json").exists(),
        build_date: build_date(),
    }
}

#[tauri::command]
pub fn get_storage_usage(app: tauri::AppHandle) -> StorageUsage {
    let data = data_dir(&app);
    let cache = cache_dir(&app);

    StorageUsage {
        cache_bytes: dir_size(&cache),
        data_bytes: dir_size(&data.join(".agentic-os")),
        logs_bytes: dir_size(&data.join("logs")),
        total_bytes: dir_size(&data) + dir_size(&cache),
    }
}

#[tauri::command]
pub async fn clear_cache(app: tauri::AppHandle) -> Result<String, String> {
    let cache = cache_dir(&app);
    if cache.exists() {
        std::fs::remove_dir_all(&cache).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
    }
    Ok("Cache cleared successfully".to_string())
}

#[tauri::command]
pub async fn clear_workspace_memory(app: tauri::AppHandle) -> Result<String, String> {
    let data = data_dir(&app);
    let memory_dir = data.join(".agentic-os").join("memory");
    if memory_dir.exists() {
        std::fs::remove_dir_all(&memory_dir).map_err(|e| e.to_string())?;
    }
    Ok("Workspace memory cleared successfully".to_string())
}

#[tauri::command]
pub async fn clear_model_cache(app: tauri::AppHandle) -> Result<String, String> {
    let cache = cache_dir(&app);
    let model_cache = cache.join("models");
    if model_cache.exists() {
        std::fs::remove_dir_all(&model_cache).map_err(|e| e.to_string())?;
    }
    Ok("Model cache cleared successfully".to_string())
}

#[tauri::command]
pub async fn reset_settings(app: tauri::AppHandle) -> Result<String, String> {
    let data = data_dir(&app);
    let settings = data.join(".agentic-os").join("settings.json");
    if settings.exists() {
        std::fs::remove_file(&settings).map_err(|e| e.to_string())?;
    }
    Ok("Settings reset to defaults".to_string())
}

#[tauri::command]
pub async fn uninstall_app_data(app: tauri::AppHandle) -> Result<String, String> {
    let data = data_dir(&app);
    if data.exists() {
        std::fs::remove_dir_all(&data).map_err(|e| e.to_string())?;
    }
    Ok("All application data removed".to_string())
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub async fn open_install_location() -> Result<(), String> {
    let path = std::env::current_exe().map_err(|e| e.to_string())?;
    let parent = path.parent().ok_or("No parent directory")?;
    open::that(parent).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_data_location(app: tauri::AppHandle) -> Result<(), String> {
    let data = data_dir(&app);
    if !data.exists() {
        std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;
    }
    open::that(&data).map_err(|e| e.to_string())
}

fn build_date() -> String {
    chrono::Utc::now().format("%Y-%m-%d").to_string()
}
