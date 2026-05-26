use serde::Serialize;
use std::process::Command;
use tauri::command;

#[derive(Debug, Serialize)]
pub struct GitStatus {
    pub branch: String,
    pub changes: Vec<GitChange>,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Debug, Serialize)]
pub struct GitChange {
    pub path: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,
}

fn run_git(args: &[&str], dir: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .map_err(|e| format!("Git error: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not a git repository") {
            return Err("Not a git repository".to_string());
        }
        return Err(stderr.trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[command]
pub fn git_status(working_dir: String) -> Result<GitStatus, String> {
    let branch = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], &working_dir)
        .unwrap_or_else(|_| "unknown".to_string());

    // Get changed files
    let status_output = run_git(&["status", "--porcelain"], &working_dir)?;
    let changes: Vec<GitChange> = status_output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| {
            let status = l.get(0..2).unwrap_or("??").trim().to_string();
            let path = l.get(3..).unwrap_or("").to_string();
            GitChange { path, status }
        })
        .collect();

    // Get ahead/behind
    let ahead_behind = run_git(
        &["rev-list", "--count", "--left-right", "HEAD...@{upstream}"],
        &working_dir,
    )
    .unwrap_or_default();

    let parts: Vec<&str> = ahead_behind.split('\t').collect();
    let ahead = parts.first().and_then(|s| s.trim().parse().ok()).unwrap_or(0);
    let behind = parts.get(1).and_then(|s| s.trim().parse().ok()).unwrap_or(0);

    Ok(GitStatus {
        branch,
        changes,
        ahead,
        behind,
    })
}

#[command]
pub fn git_log(working_dir: String, max_count: usize) -> Result<Vec<GitCommit>, String> {
    let output = run_git(
        &[
            "log",
            &format!("--max-count={}", max_count),
            "--format=%H||%s||%an||%ct",
        ],
        &working_dir,
    )?;

    let commits: Vec<GitCommit> = output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| {
            let parts: Vec<&str> = l.splitn(4, "||").collect();
            GitCommit {
                hash: parts.first().unwrap_or(&"").to_string(),
                message: parts.get(1).unwrap_or(&"").to_string(),
                author: parts.get(2).unwrap_or(&"").to_string(),
                timestamp: parts.get(3).unwrap_or(&"").to_string(),
            }
        })
        .collect();

    Ok(commits)
}

#[command]
pub fn git_diff(working_dir: String, file: String) -> Result<String, String> {
    run_git(&["diff", "--", &file], &working_dir)
}

#[command]
pub fn git_commit(working_dir: String, message: String) -> Result<String, String> {
    run_git(&["add", "-A"], &working_dir)?;
    let output = run_git(&["commit", "-m", &message], &working_dir)?;
    Ok(output)
}

#[command]
pub fn git_restore(working_dir: String, file: String) -> Result<String, String> {
    run_git(&["checkout", "--", &file], &working_dir)
}

#[command]
pub fn git_init(working_dir: String) -> Result<String, String> {
    run_git(&["init"], &working_dir)
}
