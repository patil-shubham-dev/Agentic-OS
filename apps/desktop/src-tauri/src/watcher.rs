use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::mpsc;
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Clone, serde::Serialize)]
pub struct FileChangeEvent {
    pub path: String,
    pub kind: String,
}

#[tauri::command]
pub fn watch_directory(app_handle: AppHandle, path: String) -> Result<(), String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    thread::spawn(move || {
        let (tx, rx) = mpsc::channel::<Result<Event, notify::Error>>();

        let mut watcher = match RecommendedWatcher::new(tx, Config::default()) {
            Ok(w) => w,
            Err(e) => {
                log::error!("Failed to create watcher: {}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(&root, RecursiveMode::Recursive) {
            log::error!("Failed to watch directory: {}", e);
            return;
        }

        // Keep watcher alive by not dropping it until thread exits
        let _watcher = watcher;

        for res in rx {
            match res {
                Ok(event) => {
                    let kind = match event.kind {
                        EventKind::Create(_) => "created".to_string(),
                        EventKind::Modify(_) => "modified".to_string(),
                        EventKind::Remove(_) => "removed".to_string(),
                        _ => continue,
                    };

                    for path in event.paths {
                        let relative = path
                            .strip_prefix(&root)
                            .unwrap_or(&path)
                            .to_string_lossy()
                            .to_string();

                        if let Err(e) = app_handle.emit(
                            "file-changed",
                            FileChangeEvent {
                                path: relative,
                                kind: kind.clone(),
                            },
                        ) {
                            log::error!("Failed to emit event: {}", e);
                        }
                    }
                }
                Err(e) => log::error!("Watch error: {}", e),
            }
        }
    });

    Ok(())
}
