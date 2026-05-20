// Client API utilities for communicating with backend

const API_BASE = ""; // Empty for same-origin

export async function getJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

export async function postJson<T, R>(path: string, body: T, options?: RequestInit): Promise<R> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

export async function deleteJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

// Generic send method for POST/PUT
export async function sendJson<T, R>(method: string, path: string, body?: T, options?: RequestInit): Promise<R> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}

// Electron-specific API utilities
// These will only be available in desktop mode

export interface ElectronAPI {
  openFolder: () => Promise<string | null>;
  openFile: () => Promise<string | null>;
  saveFile: () => Promise<string | null>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;
  getCredentials: (service: string) => Promise<Record<string, string>>;
  setCredential: (service: string, key: string, value: string) => Promise<void>;
  deleteCredential: (service: string, key: string) => Promise<void>;
  showNotification: (title: string, body: string) => void;
  getPlatform: () => string;
  getHomePath: () => string;
  getAppPath: () => string;
}

export function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== "undefined" && (window as any).electronAPI) {
    return (window as any).electronAPI;
  }
  return null;
}

export function isDesktop(): boolean {
  return typeof window !== "undefined" && !!(window as any).electronAPI;
}