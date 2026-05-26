use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{command, AppHandle, Manager};

pub struct HistoryState(pub Mutex<Vec<FileSnapshot>>);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileSnapshot {
    pub path: String,
    pub content: String,
    pub timestamp: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiffResult {
    pub path: String,
    pub old_content: String,
    pub new_content: String,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiffHunk {
    pub old_start: usize,
    pub old_count: usize,
    pub new_start: usize,
    pub new_count: usize,
    pub lines: Vec<String>,
}

fn now_iso() -> String {
    let dur = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    let millis = dur.subsec_millis();
    // Simple ISO-like format
    let days = secs / 86400;
    let time = secs % 86400;
    let hours = time / 3600;
    let mins = (time % 3600) / 60;
    let sec = time % 60;
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z", 1970 + days / 365, 1, 1, hours, mins, sec, millis)
}

const MAX_SNAPSHOTS: usize = 500;

#[command]
pub fn save_snapshot(
    app: AppHandle,
    path: String,
    content: String,
    description: String,
) -> Result<(), String> {
    let state = app.state::<HistoryState>();
    let mut history = state.0.lock().unwrap();
    history.push(FileSnapshot {
        path,
        content,
        timestamp: now_iso(),
        description,
    });
    if history.len() > MAX_SNAPSHOTS {
        let excess = history.len() - MAX_SNAPSHOTS;
        history.drain(0..excess);
    }
    Ok(())
}

#[command]
pub fn get_history(app: AppHandle, path: String) -> Result<Vec<FileSnapshot>, String> {
    let state = app.state::<HistoryState>();
    let history = state.0.lock().unwrap();
    let mut result: Vec<FileSnapshot> = history
        .iter()
        .filter(|s| s.path == path)
        .cloned()
        .collect();
    result.reverse();
    Ok(result)
}

#[command]
pub fn rollback_to(
    app: AppHandle,
    path: String,
    timestamp: String,
) -> Result<String, String> {
    let state = app.state::<HistoryState>();
    let history = state.0.lock().unwrap();
    let snapshot = history
        .iter()
        .find(|s| s.path == path && s.timestamp == timestamp)
        .ok_or("Snapshot not found")?;

    fs::write(&path, &snapshot.content).map_err(|e| e.to_string())?;
    Ok(snapshot.content.clone())
}

#[command]
pub fn compute_diff(old_content: String, new_content: String) -> Result<DiffResult, String> {
    let mut hunks = Vec::new();
    let old_lines: Vec<&str> = old_content.lines().collect();
    let new_lines: Vec<&str> = new_content.lines().collect();

    let max_len = old_lines.len().max(new_lines.len());
    let mut hunk_lines = Vec::new();
    let mut in_hunk = false;
    let mut old_start = 0;
    let mut new_start = 0;

    for i in 0..max_len {
        let old_line = old_lines.get(i).copied().unwrap_or("");
        let new_line = new_lines.get(i).copied().unwrap_or("");

        if old_line != new_line {
            if !in_hunk {
                in_hunk = true;
                old_start = i + 1;
                new_start = i + 1;
            }
            hunk_lines.push(format!("-{old_line}"));
            hunk_lines.push(format!("+{new_line}"));
        } else if in_hunk {
            hunks.push(DiffHunk {
                old_start,
                old_count: old_lines.len().saturating_sub(old_start.saturating_sub(1)),
                new_start,
                new_count: new_lines.len().saturating_sub(new_start.saturating_sub(1)),
                lines: hunk_lines.clone(),
            });
            hunk_lines.clear();
            in_hunk = false;
        }
    }

    if in_hunk {
        hunks.push(DiffHunk {
            old_start,
            old_count: old_lines.len().saturating_sub(old_start.saturating_sub(1)),
            new_start,
            new_count: new_lines.len().saturating_sub(new_start.saturating_sub(1)),
            lines: hunk_lines,
        });
    }

    Ok(DiffResult {
        path: String::new(),
        old_content,
        new_content,
        hunks,
    })
}

pub fn init_history_state() -> HistoryState {
    HistoryState(Mutex::new(Vec::new()))
}
