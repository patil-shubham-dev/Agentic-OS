import { fetch as tauriPluginFetch } from '@tauri-apps/plugin-http'

let _isTauri: boolean | null = null

function isTauriRuntime(): boolean {
  if (_isTauri !== null) return _isTauri
  _isTauri = typeof window !== 'undefined' && typeof (window as any).__TAURI_INTERNALS__ !== 'undefined'
  return _isTauri
}

export async function tauriFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  if (isTauriRuntime()) {
    return tauriPluginFetch(input, init)
  }
  return globalThis.fetch(input, init)
}
