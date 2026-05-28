use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::{
    menu::{MenuBuilder, SubmenuBuilder},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize, Deserialize, Clone)]
struct UpdateStatusPayload {
    status: String,
    version: Option<String>,
    progress: Option<f64>,
}

#[tauri::command]
fn get_app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "AgenticOS",
        "version": "2.1.0",
        "identifier": "com.agenticos.studio",
        "description": "AgenticOS — Your AI operating system for development",
    })
}

#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let check = updater.check().await.map_err(|e| e.to_string())?;

    match check {
        Some(update) => Ok(serde_json::json!({
            "updateAvailable": true,
            "version": update.version,
            "downloadUrl": update.download_url,
        })),
        None => Ok(serde_json::json!({
            "updateAvailable": false,
            "version": null,
            "downloadUrl": null,
        })),
    }
}

#[tauri::command]
async fn send_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn register_context_menu() -> Result<(), String> {
    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_str = exe_path.to_string_lossy().to_string();
    let quoted = format!("\"{}\" \"%V\"", exe_str);

    let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);

    // Directory right-click
    let dir_key = hkcu
        .create_subkey(r"Software\Classes\Directory\shell\AgenticOS")
        .map_err(|e| format!("Failed to create key: {}", e))?;
    dir_key
        .0
        .set_value("", &"Open with AgenticOS")
        .map_err(|e| format!("Failed to set value: {}", e))?;
    dir_key
        .0
        .set_value("Icon", &exe_str)
        .map_err(|e| format!("Failed to set icon: {}", e))?;

    let cmd_key = hkcu
        .create_subkey(r"Software\Classes\Directory\shell\AgenticOS\command")
        .map_err(|e| format!("Failed to create command key: {}", e))?;
    cmd_key
        .0
        .set_value("", &quoted)
        .map_err(|e| format!("Failed to set command: {}", e))?;

    // Folder background
    let bg_key = hkcu
        .create_subkey(r"Software\Classes\Directory\Background\shell\AgenticOS")
        .map_err(|e| format!("Failed to create bg key: {}", e))?;
    bg_key
        .0
        .set_value("", &"Open with AgenticOS")
        .map_err(|e| format!("Failed to set bg value: {}", e))?;
    bg_key
        .0
        .set_value("Icon", &exe_str)
        .map_err(|e| format!("Failed to set bg icon: {}", e))?;

    let bg_cmd = hkcu
        .create_subkey(r"Software\Classes\Directory\Background\shell\AgenticOS\command")
        .map_err(|e| format!("Failed to create bg command key: {}", e))?;
    bg_cmd
        .0
        .set_value("", &quoted)
        .map_err(|e| format!("Failed to set bg command: {}", e))?;

    // Drives
    let drv_key = hkcu
        .create_subkey(r"Software\Classes\Drive\shell\AgenticOS")
        .map_err(|e| format!("Failed to create drive key: {}", e))?;
    drv_key
        .0
        .set_value("", &"Open with AgenticOS")
        .map_err(|e| format!("Failed to set drive value: {}", e))?;
    drv_key
        .0
        .set_value("Icon", &exe_str)
        .map_err(|e| format!("Failed to set drive icon: {}", e))?;

    let drv_cmd = hkcu
        .create_subkey(r"Software\Classes\Drive\shell\AgenticOS\command")
        .map_err(|e| format!("Failed to create drive command key: {}", e))?;
    drv_cmd
        .0
        .set_value("", &quoted)
        .map_err(|e| format!("Failed to set drive command: {}", e))?;

    // Notify Explorer (best-effort)
    let _ = std::process::Command::new("cmd")
        .args(["/c", "ie4uinit.exe", "-show"])
        .spawn();

    Ok(())
}

#[tauri::command]
fn unregister_context_menu() -> Result<(), String> {
    let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
    let paths = [
        r"Software\Classes\Directory\shell\AgenticOS",
        r"Software\Classes\Directory\Background\shell\AgenticOS",
        r"Software\Classes\Drive\shell\AgenticOS",
    ];
    for path in &paths {
        let _ = hkcu.delete_subkey_all(*path);
    }
    Ok(())
}

#[tauri::command]
fn is_context_menu_registered() -> Result<bool, String> {
    let hkcu = winreg::RegKey::predef(winreg::enums::HKEY_CURRENT_USER);
    match hkcu.open_subkey(r"Software\Classes\Directory\shell\AgenticOS") {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[derive(Serialize, Deserialize, Clone)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: Option<u64>,
    #[serde(rename = "lastModified")]
    last_modified: Option<u64>,
    children: Vec<FileEntry>,
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    fn read_dir_recursive(dir_path: &Path, root_path: &Path) -> Result<Vec<FileEntry>, String> {
        let mut entries = Vec::new();

        let dir = std::fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

        for entry in dir {
            let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
            let name = entry
                .file_name()
                .to_string_lossy()
                .to_string();
            let full_path = entry.path();

            // Get metadata once — provides file_type, size, and modified time
            let metadata = entry.metadata().map_err(|e| format!("Failed to read metadata: {}", e))?;
            let is_dir = metadata.is_dir();
            let size = if metadata.is_file() { Some(metadata.len()) } else { None };
            let last_modified = metadata.modified().ok().map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64
            });

            let relative_path = full_path
                .strip_prefix(root_path)
                .unwrap_or(&full_path)
                .to_string_lossy()
                .to_string()
                .replace('/', "\\");

            let children = if is_dir {
                read_dir_recursive(&full_path, root_path)?
            } else {
                Vec::new()
            };

            entries.push(FileEntry {
                name,
                path: relative_path,
                is_dir,
                size,
                last_modified,
                children,
            });
        }

        entries.sort_by(|a, b| {
            if a.is_dir != b.is_dir {
                b.is_dir.cmp(&a.is_dir)
            } else {
                a.name.cmp(&b.name)
            }
        });

        Ok(entries)
    }

    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    read_dir_recursive(root, root)
}

pub fn run() {
    // Capture the folder path from command line args (context menu "Open with AgenticOS")
    let initial_path: Option<String> = std::env::args().nth(1);

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            // Emit the initial path to the webview if provided (from context menu)
            if let Some(path) = initial_path {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit(
                        "open-folder",
                        serde_json::json!({ "path": path }),
                    );
                }
            }

            // ── System Tray ─────────────────────────────────────────────────
            let file = SubmenuBuilder::new(app, "File")
                .text("new-file", "New File\tCtrl+N")
                .text("open-folder", "Open Folder\tCtrl+O")
                .separator()
                .text("settings", "Settings\tCtrl+,")
                .separator()
                .quit()
                .build()?;

            let edit = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .separator()
                .select_all()
                .build()?;

            let view = SubmenuBuilder::new(app, "View")
                .text("toggle-sidebar", "Toggle Sidebar\tCtrl+B")
                .text("toggle-terminal", "Toggle Terminal\tCtrl+`")
                .separator()
                .text("zoom-in", "Zoom In\tCtrl++")
                .text("zoom-out", "Zoom Out\tCtrl+-")
                .text("zoom-reset", "Reset Zoom\tCtrl+0")
                .separator()
                .text("enter-fullscreen", "Enter Fullscreen\tF11")
                .build()?;

            let help = SubmenuBuilder::new(app, "Help")
                .text("about", "About AgenticOS")
                .text("check-updates", "Check for Updates\u{2026}")
                .separator()
                .text("documentation", "Documentation")
                .text("report-issue", "Report an Issue\u{2026}")
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&file)
                .item(&edit)
                .item(&view)
                .item(&help)
                .build()?;

            app.set_menu(menu)?;

            // Build tray menu
            let tray_menu = MenuBuilder::new(app)
                .text("show-window", "Show AgenticOS")
                .separator()
                .quit()
                .build()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("AgenticOS")
                .menu(&tray_menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show-window" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // ── Keyboard shortcut handler ──────────────────────────────────
            let app_handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                let window = _app.get_webview_window("main");
                match event.id().as_ref() {
                    "toggle-sidebar" => {
                        if let Some(win) = window {
                            let _ = win.emit(
                                "menu-action",
                                serde_json::json!({ "action": "toggle-sidebar" }),
                            );
                        }
                    }
                    "toggle-terminal" => {
                        if let Some(win) = window {
                            let _ = win.emit(
                                "menu-action",
                                serde_json::json!({ "action": "toggle-terminal" }),
                            );
                        }
                    }
                    "about" => {
                        if let Some(win) = window {
                            let _ = win.emit(
                                "menu-action",
                                serde_json::json!({ "action": "show-about" }),
                            );
                        }
                    }
                    "check-updates" => {
                        let app_h = app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            match app_h.updater() {
                                Ok(updater) => match updater.check().await {
                                    Ok(Some(_update)) => {
                                        let _ = app_h.emit(
                                            "update-status",
                                            UpdateStatusPayload {
                                                status: "available".into(),
                                                version: Some(_update.version.to_string()),
                                                progress: None,
                                            },
                                        );
                                    }
                                    Ok(None) => {
                                        let _ = app_h.emit(
                                            "update-status",
                                            UpdateStatusPayload {
                                                status: "up-to-date".into(),
                                                version: None,
                                                progress: None,
                                            },
                                        );
                                    }
                                    Err(e) => {
                                        let _ = app_h.emit(
                                            "update-status",
                                            UpdateStatusPayload {
                                                status: format!("error: {}", e),
                                                version: None,
                                                progress: None,
                                            },
                                        );
                                    }
                                },
                                Err(e) => {
                                    let _ = app_h.emit(
                                        "update-status",
                                        UpdateStatusPayload {
                                            status: format!("error: {}", e),
                                            version: None,
                                            progress: None,
                                        },
                                    );
                                }
                            }
                        });
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            check_for_updates,
            send_notification,
            register_context_menu,
            unregister_context_menu,
            is_context_menu_registered,
            list_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running AgenticOS");
}
