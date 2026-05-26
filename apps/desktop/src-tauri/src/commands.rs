use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::{command, Emitter};
use walkdir::WalkDir;

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileEntry>,
}

#[command]
pub fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let root = Path::new(&path);
    if !root.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    list_dir_recursive(root, root)
}

fn list_dir_recursive(base: &Path, dir: &Path) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let read_dir = dir.read_dir().map_err(|e| e.to_string())?;

    let mut dirs: Vec<_> = Vec::new();
    let mut files: Vec<_> = Vec::new();

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        if name.starts_with('.') {
            continue;
        }
        if name == "node_modules" || name == "target" {
            continue;
        }

        let relative = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        if path.is_dir() {
            let children = list_dir_recursive(base, &path)?;
            dirs.push(FileEntry {
                name,
                path: relative,
                is_dir: true,
                children,
            });
        } else if path.is_file() {
            files.push(FileEntry {
                name,
                path: relative,
                is_dir: false,
                children: vec![],
            });
        }
    }

    dirs.sort_by(|a, b| a.name.cmp(&b.name));
    files.sort_by(|a, b| a.name.cmp(&b.name));
    entries.extend(dirs);
    entries.extend(files);

    Ok(entries)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[command]
pub fn run_command(working_dir: String, command: String, args: Vec<String>) -> Result<ExecResult, String> {
    let output = Command::new(&command)
        .args(&args)
        .current_dir(&working_dir)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(ExecResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}

#[command]
pub async fn run_command_stream(
    command: String,
    cwd: String,
    stream_id: String,
    window: tauri::Window,
) -> Result<i32, String> {
    let mut child = Command::new("cmd")
        .args(["/C", &command])
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            let line = line.map_err(|e| e.to_string())?;
            window
                .emit(&format!("terminal-output:{}", stream_id), line)
                .map_err(|e| e.to_string())?;
        }
    }

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            let line = line.map_err(|e| e.to_string())?;
            window
                .emit(&format!("terminal-output:{}", stream_id), line)
                .map_err(|e| e.to_string())?;
        }
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    let code = status.code().unwrap_or(-1);
    window
        .emit(&format!("terminal-complete:{}", stream_id), code)
        .map_err(|e| e.to_string())?;
    Ok(code)
}

#[derive(Debug, Serialize)]
pub struct SymbolExtraction {
    pub symbols: Vec<String>,
    pub imports: Vec<String>,
}

#[command]
pub fn extract_symbols(path: String) -> Result<SymbolExtraction, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;

    let export_re = regex::Regex::new(
        r"(?:export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+))|(?:export\s+class\s+([A-Za-z0-9_]+))|(?:export\s+(?:const|let|var|type|interface)\s+([A-Za-z0-9_]+))"
    ).map_err(|e| e.to_string())?;
    let import_re = regex::Regex::new(
        r#"import\s+.*?\s+from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)"#
    ).map_err(|e| e.to_string())?;

    let mut symbols = Vec::new();
    for caps in export_re.captures_iter(&content) {
        for i in 1..=3 {
            if let Some(m) = caps.get(i) {
                symbols.push(m.as_str().to_string());
            }
        }
    }

    let mut imports = Vec::new();
    for caps in import_re.captures_iter(&content) {
        for i in 1..=2 {
            if let Some(m) = caps.get(i) {
                imports.push(m.as_str().to_string());
            }
        }
    }

    Ok(SymbolExtraction { symbols, imports })
}

#[derive(Debug, Serialize)]
pub struct GrepMatch {
    pub file: String,
    pub line: usize,
    pub content: String,
}

#[command]
pub fn grep_files(root: String, pattern: String, include: Option<String>) -> Result<Vec<GrepMatch>, String> {
    let re = regex::Regex::new(&pattern).map_err(|e| format!("Invalid regex: {}", e))?;
    let root_path = Path::new(&root);
    let mut results = Vec::new();

    let include_ext = include.as_ref().map(|s| s.split(',').map(|e| e.trim().to_lowercase()).collect::<Vec<_>>());

    for entry in WalkDir::new(root_path).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() { continue; }
        let path = entry.path();

        let rel = path.strip_prefix(root_path).unwrap_or(path);
        if rel.components().any(|c| {
            let s = c.as_os_str().to_string_lossy();
            s.starts_with('.') || s == "node_modules" || s == "target"
        }) { continue; }

        if let Some(exts) = &include_ext {
            let ext = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
            if !exts.contains(&ext) { continue; }
        }

        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        for (i, line) in content.lines().enumerate() {
            if re.is_match(line) {
                results.push(GrepMatch {
                    file: rel.to_string_lossy().to_string(),
                    line: i + 1,
                    content: line.to_string(),
                });
            }
        }
    }

    Ok(results)
}

#[derive(Debug, Serialize)]
pub struct GlobMatch {
    pub path: String,
    pub is_dir: bool,
}

#[command]
pub fn glob_files(root: String, pattern: String) -> Result<Vec<GlobMatch>, String> {
    let root_path = Path::new(&root);
    let glob_pattern = glob::Pattern::new(&pattern).map_err(|e| format!("Invalid glob: {}", e))?;
    let mut results = Vec::new();

    for entry in WalkDir::new(root_path).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let rel = path.strip_prefix(root_path).unwrap_or(path).to_string_lossy().to_string();

        if rel.starts_with('.') || rel.contains("\\.git") || rel.contains("\\node_modules") || rel.contains("\\target") {
            continue;
        }

        if glob_pattern.matches(&rel) || glob_pattern.matches(path.to_string_lossy().as_ref()) {
            results.push(GlobMatch {
                path: rel,
                is_dir: entry.file_type().is_dir(),
            });
        }
    }

    Ok(results)
}

#[command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    fs::read_to_string(file_path).map_err(|e| e.to_string())
}

#[command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(file_path, &content).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct EditOperation {
    pub file: String,
    pub old_string: String,
    pub new_string: String,
}

#[command]
pub fn edit_file(operation: EditOperation) -> Result<(), String> {
    let file_path = Path::new(&operation.file);
    let content = fs::read_to_string(file_path).map_err(|e| format!("Failed to read {}: {}", operation.file, e))?;

    if !content.contains(&operation.old_string) {
        return Err(format!("Could not find old_string in {}", operation.file));
    }

    let new_content = content.replace(&operation.old_string, &operation.new_string);
    fs::write(file_path, &new_content).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_temp_dir() -> (TempDir, std::path::PathBuf) {
        let dir = TempDir::new().unwrap();
        let path = dir.path().to_path_buf();
        (dir, path)
    }

    #[test]
    fn test_list_directory_empty() {
        let (_dir, path) = setup_temp_dir();
        let entries = list_directory(path.to_string_lossy().to_string()).unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn test_list_directory_with_files() {
        let (_dir, path) = setup_temp_dir();
        fs::write(path.join("a.txt"), "hello").unwrap();
        fs::write(path.join("b.txt"), "world").unwrap();
        fs::create_dir(path.join("sub")).unwrap();
        fs::write(path.join("sub").join("c.txt"), "nested").unwrap();

        let entries = list_directory(path.to_string_lossy().to_string()).unwrap();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].name, "sub");
        assert!(entries[0].is_dir);
        assert_eq!(entries[0].children.len(), 1);
        assert_eq!(entries[1].name, "a.txt");
        assert_eq!(entries[2].name, "b.txt");
    }

    #[test]
    fn test_list_directory_skips_hidden() {
        let (_dir, path) = setup_temp_dir();
        fs::write(path.join(".hidden"), "secret").unwrap();
        fs::write(path.join("visible.txt"), "hello").unwrap();

        let entries = list_directory(path.to_string_lossy().to_string()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "visible.txt");
    }

    #[test]
    fn test_list_directory_not_found() {
        let result = list_directory("C:\\nonexistent_path_xyz".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_write_text_file_creates_file() {
        let (_dir, path) = setup_temp_dir();
        let file_path = path.join("test.txt");
        let path_str = file_path.to_string_lossy().to_string();

        write_text_file(path_str.clone(), "Hello, World!".to_string()).unwrap();
        assert!(file_path.exists());
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "Hello, World!");
    }

    #[test]
    fn test_write_text_file_creates_directories() {
        let (_dir, path) = setup_temp_dir();
        let file_path = path.join("a").join("b").join("c").join("deep.txt");
        let path_str = file_path.to_string_lossy().to_string();

        write_text_file(path_str.clone(), "nested".to_string()).unwrap();
        assert!(file_path.exists());
    }

    #[test]
    fn test_edit_file_find_replace() {
        let (_dir, path) = setup_temp_dir();
        let file_path = path.join("edit.txt");
        let path_str = file_path.to_string_lossy().to_string();
        fs::write(&file_path, "Hello old world").unwrap();

        let op = EditOperation {
            file: path_str,
            old_string: "old".to_string(),
            new_string: "new".to_string(),
        };
        edit_file(op).unwrap();

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "Hello new world");
    }

    #[test]
    fn test_edit_file_not_found() {
        let op = EditOperation {
            file: "C:\\nonexistent.txt".to_string(),
            old_string: "foo".to_string(),
            new_string: "bar".to_string(),
        };
        let result = edit_file(op);
        assert!(result.is_err());
    }

    #[test]
    fn test_grep_files_finds_pattern() {
        let (_dir, path) = setup_temp_dir();
        fs::write(path.join("match.txt"), "line1\nhello world\nline3").unwrap();
        fs::write(path.join("no_match.txt"), "nothing here").unwrap();

        let results = grep_files(
            path.to_string_lossy().to_string(),
            "hello".to_string(),
            None,
        ).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file, "match.txt");
        assert_eq!(results[0].line, 2);
        assert!(results[0].content.contains("hello"));
    }

    #[test]
    fn test_grep_files_with_extension_filter() {
        let (_dir, path) = setup_temp_dir();
        fs::write(path.join("a.ts"), "const x = 1").unwrap();
        fs::write(path.join("a.js"), "const x = 1").unwrap();

        let results = grep_files(
            path.to_string_lossy().to_string(),
            "const".to_string(),
            Some("ts".to_string()),
        ).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file, "a.ts");
    }

    #[test]
    fn test_grep_files_invalid_regex() {
        let (_dir, path) = setup_temp_dir();
        let result = grep_files(
            path.to_string_lossy().to_string(),
            "[invalid".to_string(),
            None,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_glob_files_finds_pattern() {
        let (_dir, path) = setup_temp_dir();
        fs::write(path.join("hello.ts"), "content").unwrap();
        fs::write(path.join("hello.js"), "content").unwrap();
        fs::write(path.join("world.ts"), "content").unwrap();
        fs::create_dir(path.join("sub")).unwrap();
        fs::write(path.join("sub").join("nested.ts"), "content").unwrap();

        let results = glob_files(
            path.to_string_lossy().to_string(),
            "**/*.ts".to_string(),
        ).unwrap();
        assert_eq!(results.len(), 3);
    }

    #[test]
    fn test_run_command_echo() {
        let (_dir, path) = setup_temp_dir();
        let result = run_command(
            path.to_string_lossy().to_string(),
            "cmd".to_string(),
            vec!["/C".to_string(), "echo".to_string(), "hello".to_string()],
        ).unwrap();
        assert_eq!(result.exit_code, 0);
        assert!(result.stdout.contains("hello"));
    }

    #[test]
    fn test_run_command_not_found() {
        let (_dir, path) = setup_temp_dir();
        let result = run_command(
            path.to_string_lossy().to_string(),
            "nonexistent_command_xyz".to_string(),
            vec![],
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_write_text_file_empty_content() {
        let (_dir, path) = setup_temp_dir();
        let file_path = path.join("empty.txt");
        let path_str = file_path.to_string_lossy().to_string();

        write_text_file(path_str.clone(), "".to_string()).unwrap();
        assert!(file_path.exists());
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "");
    }

    #[test]
    fn test_edit_file_no_match() {
        let (_dir, path) = setup_temp_dir();
        let file_path = path.join("no_match_edit.txt");
        let path_str = file_path.to_string_lossy().to_string();
        fs::write(&file_path, "Hello world").unwrap();

        let op = EditOperation {
            file: path_str,
            old_string: "nonexistent".to_string(),
            new_string: "replacement".to_string(),
        };
        let result = edit_file(op);
        assert!(result.is_err());
    }

    #[test]
    fn test_list_directory_skips_node_modules() {
        let (_dir, path) = setup_temp_dir();
        fs::create_dir(path.join("node_modules")).unwrap();
        fs::write(path.join("node_modules").join("pkg.js"), "code").unwrap();
        fs::write(path.join("main.js"), "app code").unwrap();

        let entries = list_directory(path.to_string_lossy().to_string()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "main.js");
    }
}
