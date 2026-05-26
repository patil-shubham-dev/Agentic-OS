pub mod command;
pub mod commands;
pub mod fs;
pub mod network;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct SandboxViolation {
    pub category: String,
    pub detail: String,
    pub severity: ViolationSeverity,
}

#[derive(Debug, Clone, Serialize)]
pub enum ViolationSeverity {
    Allow,
    Deny,
    Warn,
}

pub trait SandboxRule: Send + Sync {
    fn name(&self) -> &str;
    fn check(&self, context: &str) -> Result<(), SandboxViolation>;
}

pub trait SandboxPolicy: Send + Sync {
    fn validate_command(&self, command: &str, args: &[String]) -> Result<(), SandboxViolation>;
    fn validate_path(&self, path: &str, mode: AccessMode) -> Result<(), SandboxViolation>;
    fn validate_url(&self, url: &str) -> Result<(), SandboxViolation>;
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AccessMode {
    Read,
    Write,
    Execute,
    ReadWrite,
}
