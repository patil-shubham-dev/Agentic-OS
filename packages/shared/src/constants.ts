export const APP_NAME = "Agentic-OS Studio"
export const APP_IDENTIFIER = "com.agenticos.studio"
export const APP_VERSION = "1.0.0"

export const CONFIG_DIR = ".agentic-os"
export const SETTINGS_FILE = "settings.json"
export const LEDGER_FILE = "ledger.json"

export const DEFAULT_WINDOW_WIDTH = 1280
export const DEFAULT_WINDOW_HEIGHT = 800
export const DEFAULT_WINDOW_MIN_WIDTH = 900
export const DEFAULT_WINDOW_MIN_HEIGHT = 600

export const UPDATE_CHECK_URL = "https://releases.agentic-os.com/updates"

export const DEFAULT_ROLES = [
  {
    id: "manager",
    name: "Manager",
    color: "amber",
    icon: "brain",
    temperature: 0.7,
    maxTokens: 32768,
    capabilities: { coding: false, browsing: false, planning: true, memory: true, fileAccess: false, internetAccess: false, toolExecution: true, sandboxEscape: false, vision: false, reasoning: true, orchestration: true },
    priority: 1,
  },
  {
    id: "coding",
    name: "Coding",
    color: "blue",
    icon: "code",
    temperature: 0.2,
    maxTokens: 64000,
    capabilities: { coding: true, browsing: false, planning: false, memory: true, fileAccess: true, internetAccess: false, toolExecution: true, sandboxEscape: false, vision: false, reasoning: false, orchestration: false },
    priority: 2,
  },
  {
    id: "design",
    name: "Design",
    color: "purple",
    icon: "palette",
    temperature: 0.8,
    maxTokens: 32768,
    capabilities: { coding: true, browsing: false, planning: false, memory: true, fileAccess: true, internetAccess: false, toolExecution: false, sandboxEscape: false, vision: true, reasoning: false, orchestration: false },
    priority: 3,
  },
] as const
