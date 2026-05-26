import type { FileEntry, FileChangeEvent } from "@/types"

export async function pickWorkspaceFolder(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog")
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Workspace Folder",
    })
    return selected as string | null
  } catch {
    return null
  }
}

export async function loadFileTree(rootPath: string): Promise<FileEntry[]> {
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return await invoke<FileEntry[]>("list_directory", { path: rootPath })
  } catch {
    return []
  }
}

export async function readFile(filePath: string): Promise<string> {
  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs")
    return await readTextFile(filePath)
  } catch {
    throw new Error("File system not available in web mode")
  }
}

function sanitizeFilename(name: string): string {
  const invalidChars = /[<>:"/\\|?*]/g
  const trimmed = name.trim().replace(invalidChars, "_")
  if (!trimmed || trimmed === "." || trimmed === "..") return ""
  return trimmed
}

export async function createFile(absolutePath: string, content = ""): Promise<void> {
  const t0 = performance.now()
  console.log(`[Explorer] create file`, { path: absolutePath })
  try {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs")
    await writeTextFile(absolutePath, content)
    console.log(`[Explorer] create file OK (${(performance.now() - t0).toFixed(0)}ms)`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Explorer] create file FAILED`, { path: absolutePath, error: msg })
    throw new Error(`Failed to create file: ${msg}`)
  }
}

export async function createFolder(absolutePath: string): Promise<void> {
  const t0 = performance.now()
  console.log(`[Explorer] create folder`, { path: absolutePath })
  try {
    const { mkdir } = await import("@tauri-apps/plugin-fs")
    await mkdir(absolutePath)
    console.log(`[Explorer] create folder OK (${(performance.now() - t0).toFixed(0)}ms)`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Explorer] create folder FAILED`, { path: absolutePath, error: msg })
    throw new Error(`Failed to create folder: ${msg}`)
  }
}

export async function deleteEntry(absolutePath: string): Promise<void> {
  const t0 = performance.now()
  console.log(`[Explorer] delete entry`, { path: absolutePath })
  try {
    const { remove } = await import("@tauri-apps/plugin-fs")
    await remove(absolutePath, { recursive: true })
    console.log(`[Explorer] delete entry OK (${(performance.now() - t0).toFixed(0)}ms)`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Explorer] delete entry FAILED`, { path: absolutePath, error: msg })
    throw new Error(`Failed to delete entry: ${msg}`)
  }
}

export { sanitizeFilename }

export async function renameEntry(oldPath: string, newPath: string): Promise<void> {
  const t0 = performance.now()
  console.log(`[Explorer] rename`, { from: oldPath, to: newPath })
  try {
    const { rename } = await import("@tauri-apps/plugin-fs")
    await rename(oldPath, newPath)
    console.log(`[Explorer] rename OK (${(performance.now() - t0).toFixed(0)}ms)`)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Explorer] rename FAILED`, { error: msg })
    throw new Error(`Failed to rename: ${msg}`)
  }
}

export async function startWatching(rootPath: string): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    await invoke("watch_directory", { path: rootPath })
  } catch {
  }
}

export async function onFileChange(callback: (event: FileChangeEvent) => void): Promise<(() => void) | null> {
  try {
    const { listen } = await import("@tauri-apps/api/event")
    const unlisten = await listen<FileChangeEvent>("file-changed", (event) => {
      callback(event.payload)
    })
    return unlisten
  } catch {
    return null
  }
}
