import type { FileEntry, FileChangeEvent } from "@/types"

// ── Web-mode root handle (File System Access API) ──
let _webRootHandle: FileSystemDirectoryHandle | null = null
let _webRootPath: string | null = null

function sanitizeFilename(name: string): string {
  const invalidChars = /[<>:"/\\|?*]/g
  const trimmed = name.trim().replace(invalidChars, "_")
  if (!trimmed || trimmed === "." || trimmed === "..") return ""
  return trimmed
}

// ── Tauri helpers ──

async function hasTauri(): Promise<boolean> {
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    return typeof invoke === "function"
  } catch {
    return false
  }
}

// ── Web-mode helpers ──

async function requestWebDirectory(): Promise<{ handle: FileSystemDirectoryHandle; path: string } | null> {
  try {
    if (!("showDirectoryPicker" in window)) return null
    const win = window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
    const handle = await win.showDirectoryPicker()
    const path = handle.name
    _webRootHandle = handle
    _webRootPath = path
    return { handle, path }
  } catch {
    return null
  }
}

type DirHandle = FileSystemDirectoryHandle & { entries: () => AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]> }

async function* walkDirectory(dir: FileSystemDirectoryHandle, parentPath: string): AsyncGenerator<FileEntry> {
  for await (const [name, handle] of (dir as DirHandle).entries()) {
    const entryPath = parentPath ? `${parentPath}\\${name}` : name
    if (handle.kind === "directory") {
      const children: FileEntry[] = []
      for await (const child of walkDirectory(handle as FileSystemDirectoryHandle, entryPath)) {
        children.push(child)
      }
      yield { name, path: entryPath, is_dir: true, children }
    } else {
      // Note: File metadata (size, lastModified) is not available in web mode
      // without calling getFile(), which reads the entire file content into memory.
      // To avoid performance issues with large projects, web mode skips metadata.
      // Metadata is available when using the Tauri backend.
      yield { name, path: entryPath, is_dir: false, children: [] }
    }
  }
}

async function loadWebFileTree(): Promise<FileEntry[]> {
  if (!_webRootHandle) return []
  const entries: FileEntry[] = []
  for await (const entry of walkDirectory(_webRootHandle, "")) {
    entries.push(entry)
  }
  return entries
}

async function resolveWebHandle(pathSegments: string[]): Promise<FileSystemDirectoryHandle | FileSystemFileHandle | null> {
  if (!_webRootHandle) return null
  let current: FileSystemDirectoryHandle | FileSystemFileHandle = _webRootHandle
  for (let i = 0; i < pathSegments.length; i++) {
    const seg = pathSegments[i]
    if (current.kind !== "directory") return null
    const dir = current as FileSystemDirectoryHandle
    if (i === pathSegments.length - 1) {
      try {
        return await dir.getFileHandle(seg)
      } catch {
        try {
          return await dir.getDirectoryHandle(seg)
        } catch {
          return null
        }
      }
    } else {
      try {
        current = await dir.getDirectoryHandle(seg)
      } catch {
        return null
      }
    }
  }
  return current
}

async function readWebFile(path: string): Promise<string> {
  const segs = path.split(/[/\\]+/).filter(Boolean)
  const fileHandle = await resolveWebHandle(segs)
  if (!fileHandle || fileHandle.kind !== "file") throw new Error(`File not found: ${path}`)
  const file = await (fileHandle as FileSystemFileHandle).getFile()
  return await file.text()
}

async function getWebDirHandle(path: string): Promise<FileSystemDirectoryHandle | null> {
  const segs = path.split(/[/\\]+/).filter(Boolean)
  if (segs.length === 0) return _webRootHandle
  let current = _webRootHandle
  if (!current) return null
  for (const seg of segs) {
    try {
      current = await current.getDirectoryHandle(seg)
    } catch {
      return null
    }
  }
  return current
}

// ── Public API ──

export async function pickWorkspaceFolder(): Promise<string | null> {
  // Try Tauri first
  try {
    const { open } = await import("@tauri-apps/plugin-dialog")
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Workspace Folder",
    })
    if (selected) {
      _webRootHandle = null
      _webRootPath = null
      return selected as string
    }
    return null
  } catch {
    // Fall back to File System Access API
    const result = await requestWebDirectory()
    return result?.path ?? null
  }
}

export async function loadFileTree(rootPath: string): Promise<FileEntry[]> {
  // Try Tauri first
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    const tree = await invoke<FileEntry[]>("list_directory", { path: rootPath })
    return tree
  } catch (err) {
    console.error("Failed to load file tree via Tauri:", err)
    // Web fallback
    return await loadWebFileTree()
  }
}

export async function readFile(filePath: string): Promise<string> {
  try {
    const { readTextFile } = await import("@tauri-apps/plugin-fs")
    return await readTextFile(filePath)
  } catch {
    // Web fallback
    return await readWebFile(filePath)
  }
}

export async function createFile(absolutePath: string, content = ""): Promise<void> {
  const t0 = performance.now()
  console.log(`[Explorer] create file`, { path: absolutePath })
  try {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs")
    await writeTextFile(absolutePath, content)
    console.log(`[Explorer] create file OK (${(performance.now() - t0).toFixed(0)}ms)`)
    return
  } catch (err: unknown) {
    // Try web fallback
    if (await hasTauri()) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Explorer] create file FAILED`, { path: absolutePath, error: msg })
      throw new Error(`Failed to create file: ${msg}`)
    }
  }
  // Web fallback
  const segs = absolutePath.split(/[/\\]+/).filter(Boolean)
  const fileName = segs.pop()
  if (!fileName) throw new Error("Invalid path")
  const parentDir = await getWebDirHandle(segs.join("\\"))
  if (!parentDir) throw new Error("Parent directory not found")
  const handle = await parentDir.getFileHandle(fileName, { create: true })
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
  console.log(`[Explorer] create file OK (web, ${(performance.now() - t0).toFixed(0)}ms)`)
}

export async function createFolder(absolutePath: string): Promise<void> {
  const t0 = performance.now()
  console.log(`[Explorer] create folder`, { path: absolutePath })
  try {
    const { mkdir } = await import("@tauri-apps/plugin-fs")
    await mkdir(absolutePath)
    console.log(`[Explorer] create folder OK (${(performance.now() - t0).toFixed(0)}ms)`)
    return
  } catch (err: unknown) {
    if (await hasTauri()) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Explorer] create folder FAILED`, { path: absolutePath, error: msg })
      throw new Error(`Failed to create folder: ${msg}`)
    }
  }
  // Web fallback
  const segs = absolutePath.split(/[/\\]+/).filter(Boolean)
  const folderName = segs.pop()
  if (!folderName) throw new Error("Invalid path")
  const parentDir = await getWebDirHandle(segs.join("\\"))
  if (!parentDir) throw new Error("Parent directory not found")
  await parentDir.getDirectoryHandle(folderName, { create: true })
  console.log(`[Explorer] create folder OK (web, ${(performance.now() - t0).toFixed(0)}ms)`)
}

export async function deleteEntry(absolutePath: string): Promise<void> {
  const t0 = performance.now()
  console.log(`[Explorer] delete entry`, { path: absolutePath })
  try {
    const { remove } = await import("@tauri-apps/plugin-fs")
    await remove(absolutePath, { recursive: true })
    console.log(`[Explorer] delete entry OK (${(performance.now() - t0).toFixed(0)}ms)`)
    return
  } catch (err: unknown) {
    if (await hasTauri()) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Explorer] delete entry FAILED`, { path: absolutePath, error: msg })
      throw new Error(`Failed to delete entry: ${msg}`)
    }
  }
  // Web fallback
  const segs = absolutePath.split(/[/\\]+/).filter(Boolean)
  const entryName = segs.pop()
  if (!entryName) throw new Error("Invalid path")
  const parentDir = await getWebDirHandle(segs.join("\\"))
  if (!parentDir) throw new Error("Parent directory not found")
  await parentDir.removeEntry(entryName, { recursive: true })
  console.log(`[Explorer] delete entry OK (web, ${(performance.now() - t0).toFixed(0)}ms)`)
}

export { sanitizeFilename }

export async function renameEntry(oldPath: string, newPath: string): Promise<void> {
  const t0 = performance.now()
  console.log(`[Explorer] rename`, { from: oldPath, to: newPath })
  try {
    const { rename } = await import("@tauri-apps/plugin-fs")
    await rename(oldPath, newPath)
    console.log(`[Explorer] rename OK (${(performance.now() - t0).toFixed(0)}ms)`)
    return
  } catch (err: unknown) {
    if (await hasTauri()) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[Explorer] rename FAILED`, { error: msg })
      throw new Error(`Failed to rename: ${msg}`)
    }
  }
  // Web fallback: copy + delete
  const content = await readFile(oldPath)
  await createFile(newPath, content)
  await deleteEntry(oldPath)
  console.log(`[Explorer] rename OK (web, ${(performance.now() - t0).toFixed(0)}ms)`)
}

export async function startWatching(rootPath: string): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    await invoke("watch_directory", { path: rootPath })
  } catch {
    // Web mode: watching not supported
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

// ── Web-only: get root handle for tree population ──
export function getWebRootHandle(): FileSystemDirectoryHandle | null {
  return _webRootHandle
}

export function getWebRootPath(): string | null {
  return _webRootPath
}
