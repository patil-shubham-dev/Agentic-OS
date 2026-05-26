// Lazy-loaded invoke to avoid bundling @tauri-apps/api/core into main chunk
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const mod = await import("@tauri-apps/api/core")
  return mod.invoke<T>(cmd, args)
}

export async function launchBrowser(url: string): Promise<string> {
  return await invoke<string>("browser_launch", { url })
}

export async function navigate(sessionId: string, url: string): Promise<void> {
  await invoke("browser_navigate", { sessionId, url })
}

export async function takeScreenshot(sessionId: string): Promise<string> {
  return await invoke<string>("browser_screenshot", { sessionId })
}

export async function executeJs(sessionId: string, js: string): Promise<string> {
  return await invoke<string>("browser_execute_js", { sessionId, js })
}

export async function getUrl(sessionId: string): Promise<string> {
  return await invoke<string>("browser_get_url", { sessionId })
}

export async function getTitle(sessionId: string): Promise<string> {
  return await invoke<string>("browser_get_title", { sessionId })
}

export async function closeBrowser(sessionId: string): Promise<void> {
  await invoke("browser_close", { sessionId })
}

export async function browserClick(sessionId: string, selector: string): Promise<void> {
  await invoke("browser_click", { sessionId, selector })
}

export async function browserFill(sessionId: string, selector: string, value: string): Promise<void> {
  await invoke("browser_fill", { sessionId, selector, value })
}

export async function browserWait(sessionId: string, selector: string, timeout?: number): Promise<void> {
  await invoke("browser_wait", { sessionId, selector, timeout: timeout ?? 5000 })
}

export async function browserGetText(sessionId: string, selector: string): Promise<string> {
  return await invoke<string>("browser_get_text", { sessionId, selector })
}

export async function getConsoleLogs(sessionId: string): Promise<string[]> {
  return await invoke<string[]>("browser_get_console_logs", { sessionId })
}
