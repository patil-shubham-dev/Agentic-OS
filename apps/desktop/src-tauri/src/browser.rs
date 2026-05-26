use headless_chrome::{Browser, LaunchOptions, Tab};
use headless_chrome::protocol::cdp::Page;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{command, AppHandle, Manager};

pub struct BrowserState(pub Mutex<HashMap<String, BrowserSession>>);

#[allow(dead_code)]
pub(crate) struct BrowserSession {
    browser: Browser,
    tab: Arc<Tab>,
}

#[command]
pub fn browser_launch(app: AppHandle, url: String) -> Result<String, String> {
    let browser = Browser::new(
        LaunchOptions {
            headless: true,
            sandbox: false,
            ..Default::default()
        },
    )
    .map_err(|e| format!("Launch failed: {}", e))?;

    let tab = browser.new_tab().map_err(|e| format!("Tab failed: {}", e))?;
    tab.navigate_to(&url)
        .map_err(|e| format!("Navigate failed: {}", e))?;
    tab.wait_until_navigated()
        .map_err(|e| format!("Timeout: {}", e))?;

    let session_id = uuid::Uuid::new_v4().to_string();

    let state = app.state::<BrowserState>();
    state
        .0
        .lock()
        .unwrap()
        .insert(session_id.clone(), BrowserSession { browser, tab });

    Ok(session_id)
}

#[command]
pub fn browser_navigate(app: AppHandle, session_id: String, url: String) -> Result<(), String> {
    let state = app.state::<BrowserState>();
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&session_id).ok_or("Session not found")?;
    session
        .tab
        .navigate_to(&url)
        .map_err(|e| format!("Navigate failed: {}", e))?;
    session
        .tab
        .wait_until_navigated()
        .map_err(|e| format!("Timeout: {}", e))?;
    Ok(())
}

#[command]
pub fn browser_screenshot(app: AppHandle, session_id: String) -> Result<String, String> {
    let state = app.state::<BrowserState>();
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&session_id).ok_or("Session not found")?;

    let png_data = session
        .tab
        .capture_screenshot(
            Page::CaptureScreenshotFormatOption::Png,
            None,
            None,
            true,
        )
        .map_err(|e| format!("Screenshot failed: {}", e))?;

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&png_data);
    Ok(b64)
}

#[command]
pub fn browser_execute_js(
    app: AppHandle,
    session_id: String,
    js: String,
) -> Result<String, String> {
    let state = app.state::<BrowserState>();
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&session_id).ok_or("Session not found")?;

    let result = session
        .tab
        .evaluate(&js, false)
        .map_err(|e| format!("JS failed: {}", e))?;

    Ok(result.value.map(|v| v.to_string()).unwrap_or_default())
}

#[command]
pub fn browser_get_url(app: AppHandle, session_id: String) -> Result<String, String> {
    let state = app.state::<BrowserState>();
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&session_id).ok_or("Session not found")?;
    Ok(session.tab.get_url())
}

#[command]
pub fn browser_get_title(app: AppHandle, session_id: String) -> Result<String, String> {
    let state = app.state::<BrowserState>();
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&session_id).ok_or("Session not found")?;

    let result = session
        .tab
        .evaluate("document.title", false)
        .map_err(|e| format!("JS failed: {}", e))?;

    Ok(result.value.map(|v| v.to_string()).unwrap_or_default())
}

#[command]
pub fn browser_close(app: AppHandle, session_id: String) -> Result<(), String> {
    let state = app.state::<BrowserState>();
    let mut sessions = state.0.lock().unwrap();
    sessions.remove(&session_id);
    Ok(())
}

#[command]
pub fn browser_click(app: AppHandle, session_id: String, selector: String) -> Result<(), String> {
    let state = app.state::<BrowserState>();
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&session_id).ok_or("Session not found")?;

    let js = format!(
        r#"document.querySelector('{}').click()"#,
        selector.replace('\'', "\\'")
    );
    session
        .tab
        .evaluate(&js, false)
        .map_err(|e| format!("Click failed: {}", e))?;
    Ok(())
}

#[command]
pub fn browser_fill(
    app: AppHandle,
    session_id: String,
    selector: String,
    value: String,
) -> Result<(), String> {
    let state = app.state::<BrowserState>();
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&session_id).ok_or("Session not found")?;

    let escaped = value.replace('\\', "\\\\").replace('\'', "\\'");
    let js = format!(
        r#"const el = document.querySelector('{}'); if (el) {{ el.value = '{}'; el.dispatchEvent(new Event('input', {{ bubbles: true }})); el.dispatchEvent(new Event('change', {{ bubbles: true }})); }}"#,
        selector.replace('\'', "\\'"),
        escaped,
    );
    session
        .tab
        .evaluate(&js, false)
        .map_err(|e| format!("Fill failed: {}", e))?;
    Ok(())
}

#[command]
pub fn browser_wait(
    app: AppHandle,
    session_id: String,
    selector: String,
    timeout: u64,
) -> Result<(), String> {
    let state = app.state::<BrowserState>();
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&session_id).ok_or("Session not found")?;

    let js = format!(
        r#"new Promise((resolve, reject) => {{
            const start = Date.now();
            const interval = setInterval(() => {{
                if (document.querySelector('{}')) {{
                    clearInterval(interval);
                    resolve(true);
                }}
                if (Date.now() - start > {}) {{
                    clearInterval(interval);
                    reject(new Error('Timeout waiting for selector: {}'));
                }}
            }}, 100);
        }})"#,
        selector.replace('\'', "\\'"),
        timeout,
        selector.replace('\'', "\\'"),
    );
    session
        .tab
        .evaluate(&js, false)
        .map_err(|e| format!("Wait failed: {}", e))?;
    Ok(())
}

#[command]
pub fn browser_get_text(
    app: AppHandle,
    session_id: String,
    selector: String,
) -> Result<String, String> {
    let state = app.state::<BrowserState>();
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&session_id).ok_or("Session not found")?;

    let js = format!(
        r#"(document.querySelector('{}')?.textContent || '').trim()"#,
        selector.replace('\'', "\\'"),
    );
    let result = session
        .tab
        .evaluate(&js, false)
        .map_err(|e| format!("Get text failed: {}", e))?;

    Ok(result.value.map(|v| v.to_string()).unwrap_or_default())
}

#[command]
pub fn browser_get_console_logs(
    app: AppHandle,
    session_id: String,
) -> Result<Vec<String>, String> {
    let state = app.state::<BrowserState>();
    let sessions = state.0.lock().unwrap();
    let session = sessions.get(&session_id).ok_or("Session not found")?;

    let js = r#"
        (() => {
            const logs = window.__agentic_console_logs || [];
            window.__agentic_console_logs = [];
            return logs;
        })()
    "#;
    let result = session
        .tab
        .evaluate(js, false)
        .map_err(|e| format!("Get logs failed: {}", e))?;

    let raw = result.value.map(|v| v.to_string()).unwrap_or_default();
    if raw == "[]" || raw.is_empty() {
        return Ok(vec![]);
    }
    // Try to parse as JSON array
    if let Ok(arr) = serde_json::from_str::<Vec<String>>(&raw) {
        return Ok(arr);
    }
    Ok(vec![raw])
}

pub fn init_browser_state() -> BrowserState {
    BrowserState(Mutex::new(HashMap::new()))
}
