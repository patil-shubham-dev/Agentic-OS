use crate::sandbox::{AccessMode, SandboxViolation, ViolationSeverity};
use std::path::{Path, PathBuf};

pub struct FsRule {
    pub allowed_dirs: Vec<PathBuf>,
    pub blocked_dirs: Vec<PathBuf>,
    pub max_file_size: u64,
    pub allowed_extensions: Option<Vec<String>>,
    pub blocked_extensions: Vec<String>,
    pub allow_all_read: bool,
}

impl Default for FsRule {
    fn default() -> Self {
        Self::strict()
    }
}

impl FsRule {
    pub fn permissive() -> Self {
        Self {
            allowed_dirs: vec![],
            blocked_dirs: vec![],
            max_file_size: 50 * 1024 * 1024,
            allowed_extensions: None,
            blocked_extensions: vec![
                "exe".into(), "dll".into(), "so".into(), "dylib".into(),
                "bin".into(), "msi".into(), "deb".into(), "rpm".into(),
            ],
            allow_all_read: true,
        }
    }

    pub fn strict() -> Self {
        Self {
            allowed_dirs: vec![],
            blocked_dirs: vec![
                PathBuf::from("/etc"),
                PathBuf::from("/sys"),
                PathBuf::from("/proc"),
                PathBuf::from("/dev"),
                PathBuf::from("/boot"),
                PathBuf::from("/var/log"),
                PathBuf::from("C:\\Windows"),
                PathBuf::from("C:\\Program Files"),
                PathBuf::from("C:\\Program Files (x86)"),
                PathBuf::from("C:\\System32"),
            ],
            max_file_size: 10 * 1024 * 1024,
            allowed_extensions: Some(vec![
                "ts".into(), "tsx".into(), "js".into(), "jsx".into(),
                "json".into(), "md".into(), "css".into(), "html".into(),
                "rs".into(), "toml".into(), "yaml".into(), "yml".into(),
                "py".into(), "go".into(), "java".into(), "kt".into(),
                "swift".into(), "c".into(), "h".into(), "cpp".into(),
                "txt".into(), "env".into(), "gitignore".into(),
            ]),
            blocked_extensions: vec![
                "exe".into(), "dll".into(), "so".into(), "dylib".into(),
                "bin".into(), "msi".into(), "deb".into(), "rpm".into(),
                "app".into(), "dmg".into(), "pkg".into(),
                "key".into(), "pem".into(), "cert".into(), "crt".into(),
                "keystore".into(), "jks".into(),
                "doc".into(), "docx".into(), "xls".into(), "xlsx".into(),
                "ppt".into(), "pptx".into(), "pdf".into(),
            ],
            allow_all_read: false,
        }
    }

    pub fn validate(&self, path_str: &str, mode: AccessMode) -> Result<(), SandboxViolation> {
        let path = Path::new(path_str);

        if !path.exists() && mode != AccessMode::Write {
            return Err(SandboxViolation {
                category: "path_not_found".into(),
                detail: format!("Path does not exist: {}", path_str),
                severity: ViolationSeverity::Deny,
            });
        }

        if self.allow_all_read && mode == AccessMode::Read {
            return Ok(());
        }

        let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());

        for blocked in &self.blocked_dirs {
            if canonical.starts_with(blocked) {
                return Err(SandboxViolation {
                    category: "path_blocked".into(),
                    detail: format!("Path '{}' is in blocked directory '{}'", path_str, blocked.display()),
                    severity: ViolationSeverity::Deny,
                });
            }
        }

        if !self.allowed_dirs.is_empty() {
            let allowed = self.allowed_dirs.iter().any(|d| canonical.starts_with(d));
            if !allowed {
                return Err(SandboxViolation {
                    category: "path_not_allowed".into(),
                    detail: format!("Path '{}' is not in any allowed directory", path_str),
                    severity: ViolationSeverity::Deny,
                });
            }
        }

        if canonical.is_file() {
            if let Ok(metadata) = canonical.metadata() {
                if metadata.len() > self.max_file_size {
                    return Err(SandboxViolation {
                        category: "file_too_large".into(),
                        detail: format!("File '{}' is {} bytes, max is {}", path_str, metadata.len(), self.max_file_size),
                        severity: ViolationSeverity::Deny,
                    });
                }
            }

            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();

                if self.blocked_extensions.contains(&ext_str) {
                    return Err(SandboxViolation {
                        category: "extension_blocked".into(),
                        detail: format!("File extension '.{}' is blocked", ext_str),
                        severity: ViolationSeverity::Deny,
                    });
                }

                if let Some(allowed) = &self.allowed_extensions {
                    if !allowed.contains(&ext_str) {
                        return Err(SandboxViolation {
                            category: "extension_not_allowed".into(),
                            detail: format!("File extension '.{}' is not allowed", ext_str),
                            severity: ViolationSeverity::Deny,
                        });
                    }
                }
            }
        }

        Ok(())
    }
}
