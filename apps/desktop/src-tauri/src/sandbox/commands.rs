use crate::sandbox::command::CommandRule;
use crate::sandbox::fs::FsRule;
use crate::sandbox::network::NetworkRule;
use crate::sandbox::{AccessMode, SandboxPolicy, SandboxViolation};
use serde::Serialize;
use std::sync::Mutex;
use tauri::command;

pub struct SandboxState {
    pub command_rule: Mutex<CommandRule>,
    pub fs_rule: Mutex<FsRule>,
    pub network_rule: Mutex<NetworkRule>,
    pub enabled: Mutex<bool>,
}

impl SandboxState {
    pub fn new() -> Self {
        Self {
            command_rule: Mutex::new(CommandRule::strict()),
            fs_rule: Mutex::new(FsRule::strict()),
            network_rule: Mutex::new(NetworkRule::strict()),
            enabled: Mutex::new(true),
        }
    }
}

impl SandboxPolicy for SandboxState {
    fn validate_command(&self, command: &str, args: &[String]) -> Result<(), SandboxViolation> {
        if !*self.enabled.lock().unwrap() {
            return Ok(());
        }
        let rule = self.command_rule.lock().unwrap();
        rule.validate(command, args)
    }

    fn validate_path(&self, path: &str, mode: AccessMode) -> Result<(), SandboxViolation> {
        if !*self.enabled.lock().unwrap() {
            return Ok(());
        }
        let rule = self.fs_rule.lock().unwrap();
        rule.validate(path, mode)
    }

    fn validate_url(&self, url: &str) -> Result<(), SandboxViolation> {
        if !*self.enabled.lock().unwrap() {
            return Ok(());
        }
        let rule = self.network_rule.lock().unwrap();
        rule.validate(url)
    }
}

#[derive(Serialize)]
pub struct SandboxStatus {
    pub enabled: bool,
    pub command_allowlist_count: usize,
    pub command_blocklist_count: usize,
    pub fs_allowed_dirs: usize,
    pub network_allowed_domains: usize,
}

#[command]
pub fn get_sandbox_status(state: tauri::State<SandboxState>) -> SandboxStatus {
    SandboxStatus {
        enabled: *state.enabled.lock().unwrap(),
        command_allowlist_count: state.command_rule.lock().unwrap().allowed_commands.len(),
        command_blocklist_count: state.command_rule.lock().unwrap().blocked_commands.len(),
        fs_allowed_dirs: state.fs_rule.lock().unwrap().allowed_dirs.len(),
        network_allowed_domains: state.network_rule.lock().unwrap().allowed_domains.len(),
    }
}

#[command]
pub fn set_sandbox_enabled(state: tauri::State<SandboxState>, enabled: bool) -> Result<(), String> {
    let mut current = state.enabled.lock().map_err(|e| e.to_string())?;
    *current = enabled;
    Ok(())
}

#[command]
pub fn validate_command_sandbox(
    state: tauri::State<SandboxState>,
    command: String,
    args: Vec<String>,
) -> Result<serde_json::Value, String> {
    match state.validate_command(&command, &args) {
        Ok(()) => Ok(serde_json::json!({ "allowed": true })),
        Err(violation) => Ok(serde_json::json!({
            "allowed": false,
            "category": violation.category,
            "detail": violation.detail,
        })),
    }
}

#[command]
pub fn validate_path_sandbox(
    state: tauri::State<SandboxState>,
    path: String,
    mode: String,
) -> Result<serde_json::Value, String> {
    let access_mode = match mode.to_lowercase().as_str() {
        "read" => AccessMode::Read,
        "write" => AccessMode::Write,
        "execute" => AccessMode::Execute,
        _ => AccessMode::ReadWrite,
    };

    match state.validate_path(&path, access_mode) {
        Ok(()) => Ok(serde_json::json!({ "allowed": true })),
        Err(violation) => Ok(serde_json::json!({
            "allowed": false,
            "category": violation.category,
            "detail": violation.detail,
        })),
    }
}

#[command]
pub fn validate_url_sandbox(
    state: tauri::State<SandboxState>,
    url: String,
) -> Result<serde_json::Value, String> {
    match state.validate_url(&url) {
        Ok(()) => Ok(serde_json::json!({ "allowed": true })),
        Err(violation) => Ok(serde_json::json!({
            "allowed": false,
            "category": violation.category,
            "detail": violation.detail,
        })),
    }
}
