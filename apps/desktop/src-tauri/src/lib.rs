mod browser;
mod commands;
mod desktop;
mod git;
mod history;
mod provider;
mod sandbox;
mod updater;
mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(browser::init_browser_state())
        .manage(history::init_history_state())
        .manage(sandbox::commands::SandboxState::new())
        .invoke_handler(tauri::generate_handler![
            commands::list_directory,
            commands::run_command,
            commands::run_command_stream,
            commands::grep_files,
            commands::glob_files,
            commands::read_text_file,
            commands::write_text_file,
            commands::edit_file,
            commands::extract_symbols,
            watcher::watch_directory,
            browser::browser_launch,
            browser::browser_navigate,
            browser::browser_screenshot,
            browser::browser_execute_js,
            browser::browser_get_url,
            browser::browser_get_title,
            browser::browser_close,
            browser::browser_click,
            browser::browser_fill,
            browser::browser_wait,
            browser::browser_get_text,
            browser::browser_get_console_logs,
            git::git_status,
            git::git_log,
            git::git_diff,
            git::git_commit,
            git::git_restore,
            git::git_init,
            history::save_snapshot,
            history::get_history,
            history::rollback_to,
            history::compute_diff,
            provider::commands::detect_runtime,
            provider::commands::validate_provider,
            provider::commands::discover_models,
            provider::commands::provider_chat_completion,
            provider::gateway::test_provider_connection,
            provider::gateway::stream_openai_chat,
            desktop::get_install_info,
            desktop::get_storage_usage,
            desktop::clear_cache,
            desktop::clear_workspace_memory,
            desktop::clear_model_cache,
            desktop::reset_settings,
            desktop::uninstall_app_data,
            desktop::get_app_version,
            desktop::open_install_location,
            desktop::open_data_location,
            updater::check_for_updates,
            updater::get_update_status,
            updater::perform_update,
            sandbox::commands::get_sandbox_status,
            sandbox::commands::set_sandbox_enabled,
            sandbox::commands::validate_command_sandbox,
            sandbox::commands::validate_path_sandbox,
            sandbox::commands::validate_url_sandbox,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
