use serde::Serialize;
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize)]
pub struct UpdateStatus {
    pub update_available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_notes: Option<Vec<String>>,
    pub download_progress: Option<u32>,
    pub status: String,
}

#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateStatus, String> {
    let current = env!("CARGO_PKG_VERSION").to_string();

    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                let notes = update
                    .body
                    .as_deref()
                    .map(|body| body.lines().map(String::from).collect());

                Ok(UpdateStatus {
                    update_available: true,
                    current_version: current,
                    latest_version: Some(update.version.clone()),
                    release_notes: notes,
                    download_progress: None,
                    status: "update_available".to_string(),
                })
            }
            Ok(None) => Ok(UpdateStatus {
                update_available: false,
                current_version: current,
                latest_version: None,
                release_notes: None,
                download_progress: None,
                status: "up_to_date".to_string(),
            }),
            Err(e) => Ok(UpdateStatus {
                update_available: false,
                current_version: current,
                latest_version: None,
                release_notes: None,
                download_progress: None,
                status: format!("check_failed: {}", e),
            }),
        },
        Err(e) => Ok(UpdateStatus {
            update_available: false,
            current_version: current,
            latest_version: None,
            release_notes: None,
            download_progress: None,
            status: format!("updater_error: {}", e),
        }),
    }
}

#[tauri::command]
pub async fn get_update_status(app: tauri::AppHandle) -> Result<UpdateStatus, String> {
    let current = env!("CARGO_PKG_VERSION").to_string();

    let status = match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => UpdateStatus {
                update_available: true,
                current_version: current,
                latest_version: Some(update.version.clone()),
                release_notes: update
                    .body
                    .as_deref()
                    .map(|body| body.lines().map(String::from).collect()),
                download_progress: None,
                status: "update_available".to_string(),
            },
            _ => UpdateStatus {
                update_available: false,
                current_version: current,
                latest_version: None,
                release_notes: None,
                download_progress: None,
                status: "up_to_date".to_string(),
            },
        },
        Err(_) => UpdateStatus {
            update_available: false,
            current_version: current,
            latest_version: None,
            release_notes: None,
            download_progress: None,
            status: "updater_unavailable".to_string(),
        },
    };

    Ok(status)
}

#[tauri::command]
pub async fn perform_update(app: tauri::AppHandle) -> Result<String, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No update available".to_string())?;

    update
        .download_and_install(|_progress, _total| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    Ok("Update downloaded and installed. Restart the application to apply.".to_string())
}
