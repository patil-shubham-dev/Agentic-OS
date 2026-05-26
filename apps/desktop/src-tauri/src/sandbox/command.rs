use crate::sandbox::{AccessMode, SandboxViolation, ViolationSeverity};
use std::collections::HashSet;

pub struct CommandRule {
    pub allowed_commands: HashSet<String>,
    pub blocked_commands: HashSet<String>,
    pub dangerous_flags: HashSet<String>,
    pub max_args: usize,
    pub allowed_exec_dirs: HashSet<String>,
}

impl Default for CommandRule {
    fn default() -> Self {
        Self::strict()
    }
}

impl CommandRule {
    pub fn permissive() -> Self {
        Self {
            allowed_commands: HashSet::new(),
            blocked_commands: HashSet::from([
                "sudo".into(), "su".into(), "passwd".into(), "chsh".into(),
                "mount".into(), "umount".into(), "mkfs".into(), "dd".into(),
                "shutdown".into(), "reboot".into(), "halt".into(),
            ]),
            dangerous_flags: HashSet::from([
                "--no-preserve-root".into(), "-rf".into(), "--force".into(),
            ]),
            max_args: 50,
            allowed_exec_dirs: HashSet::new(),
        }
    }

    pub fn strict() -> Self {
        Self {
            allowed_commands: HashSet::from([
                "ls".into(), "cat".into(), "head".into(), "tail".into(),
                "echo".into(), "pwd".into(), "which".into(), "whoami".into(),
                "date".into(), "dirname".into(), "basename".into(),
                "git".into(), "node".into(), "npm".into(), "npx".into(),
                "python".into(), "python3".into(), "cargo".into(),
                "rustc".into(), "go".into(), "deno".into(), "bun".into(),
                "mkdir".into(), "cp".into(), "mv".into(), "rm".into(),
                "find".into(), "grep".into(), "sed".into(), "awk".into(),
                "sort".into(), "uniq".into(), "wc".into(), "diff".into(),
                "chmod".into(), "chown".into(),
            ]),
            blocked_commands: HashSet::from([
                "sudo".into(), "su".into(), "passwd".into(), "chsh".into(),
                "mount".into(), "umount".into(), "mkfs".into(), "dd".into(),
                "shutdown".into(), "reboot".into(), "halt".into(), "poweroff".into(),
                "fdisk".into(), "parted".into(), "mkfs.ext4".into(),
                "iptables".into(), "ufw".into(), "systemctl".into(),
                "docker".into(), "curl".into(), "wget".into(),
                "ssh".into(), "scp".into(), "telnet".into(), "nc".into(),
                "eval".into(), "exec".into(), "source".into(),
                "perl".into(), "ruby".into(), "php".into(), "R".into(),
            ]),
            dangerous_flags: HashSet::from([
                "--no-preserve-root".into(), "-rf".into(), "--force".into(),
                "-exec".into(), "-delete".into(),
            ]),
            max_args: 30,
            allowed_exec_dirs: HashSet::new(),
        }
    }

    pub fn validate(&self, command: &str, args: &[String]) -> Result<(), SandboxViolation> {
        let cmd_lower = command.to_lowercase();
        let cmd_name = std::path::Path::new(&cmd_lower)
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or(cmd_lower.clone());

        if !self.allowed_commands.is_empty() && !self.allowed_commands.contains(&cmd_name) {
            if self.blocked_commands.contains(&cmd_name) {
                return Err(SandboxViolation {
                    category: "command_blocked".into(),
                    detail: format!("Command '{}' is blocked by sandbox policy", command),
                    severity: ViolationSeverity::Deny,
                });
            }
            return Err(SandboxViolation {
                category: "command_not_allowed".into(),
                detail: format!("Command '{}' is not in the allowed list", command),
                severity: ViolationSeverity::Deny,
            });
        }

        if self.blocked_commands.contains(&cmd_name) {
            return Err(SandboxViolation {
                category: "command_blocked".into(),
                detail: format!("Command '{}' is blocked by sandbox policy", command),
                severity: ViolationSeverity::Deny,
            });
        }

        if args.len() > self.max_args {
            return Err(SandboxViolation {
                category: "too_many_args".into(),
                detail: format!("Command has {} arguments, max is {}", args.len(), self.max_args),
                severity: ViolationSeverity::Deny,
            });
        }

        for arg in args {
            let arg_lower = arg.to_lowercase();
            if self.dangerous_flags.contains(arg_lower.as_str()) {
                return Err(SandboxViolation {
                    category: "dangerous_flag".into(),
                    detail: format!("Flag '{}' is dangerous and blocked", arg),
                    severity: ViolationSeverity::Deny,
                });
            }

            if arg.contains("..") || arg.contains("~") {
                return Err(SandboxViolation {
                    category: "path_traversal".into(),
                    detail: format!("Path traversal detected in argument: {}", arg),
                    severity: ViolationSeverity::Deny,
                });
            }

            if arg.contains("$") || arg.contains("`") || arg.contains("|") || arg.contains(";") {
                return Err(SandboxViolation {
                    category: "shell_injection".into(),
                    detail: format!("Shell metacharacters detected in argument: {}", arg),
                    severity: ViolationSeverity::Deny,
                });
            }
        }

        Ok(())
    }
}

impl AccessMode {
    pub fn check_command(&self, command: &str) -> Result<(), SandboxViolation> {
        match self {
            AccessMode::Read => {
                let read_commands = ["ls", "cat", "head", "tail", "echo", "pwd", "which",
                    "whoami", "date", "find", "grep", "sort", "uniq", "wc", "diff"];
                if !read_commands.contains(&command) {
                    return Err(SandboxViolation {
                        category: "read_only_mode".into(),
                        detail: format!("Command '{}' not allowed in read-only mode", command),
                        severity: ViolationSeverity::Deny,
                    });
                }
                Ok(())
            }
            _ => Ok(()),
        }
    }
}
