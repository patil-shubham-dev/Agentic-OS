# Workspace Orchestration Refactor Report

> **Date:** 2025-01-17  
> **Objective:** Refactor Workspace so the assistant behaves like Cursor/Claude Code Desktop — file-first, terminal-last — and fix critical UX bugs

---

## 1. Bug Fixes

### 1.1 Terminal Hang (XtermTerminal.tsx)

**Problem:** The Xterm.js terminal would hang after a few minutes of inactivity or during long-running commands. The SSE stream would disconnect without reconnecting, and the resize observer caused infinite loops.

**Root Cause:** Three compounding issues:
1. No retry limit on terminal initialization (would retry forever)
2. Resize observer fired synchronously on every frame, creating feedback loops
3. No heartbeat/keepalive mechanism — firewalls and proxies would kill idle SSE connections after 60s
4. No auto-reconnect on disconnect

**Fixes Applied:**
- Added max retry limit (50 attempts × 100ms = 5s max backoff)
- Debounced resize observer at 150ms to prevent callback storms
- SSE heartbeat ping every 15s via `/api/terminal/pty/write` — sends empty data, keeps connection alive
- Auto-reconnect on disconnect with 2s delay
- `mountedRef` lifecycle guard to prevent state updates after unmount
- Calls cleanup endpoint on component unmount to kill zombie PTY sessions

### 1.2 Chat Window Glitch (workspace/page.tsx)

**Problem:** The chat panel glitched on every message — would flash errors or refuse to stream responses.

**Root Cause:** AI SDK v6 (`@ai-sdk/react@3.0.187`) removed the `api` option from `useChat`'s direct options. The old code used `useChat({ api: "/api/chat" })` which caused TypeScript error `TS2353` and runtime failures.

**Fixes Applied:**
- Changed to use `DefaultChatTransport` from `ai` package:
  ```tsx
  import { DefaultChatTransport } from "ai";
  const chat = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  ```
- This is the correct AI SDK v6 pattern — `HttpChatTransport` accepts `{ api, credentials, headers, body, fetch }`
- Removed broken `DefaultChatTransport` import that was previously removed (now restored with correct usage)

### 1.3 Provider Connection Failures (providers/[id]/test/route.ts)

**Problem:** Even with correct API keys and URLs, provider test would show "Connection Failed" for NVIDIA, Together AI, and other custom providers.

**Root Cause:** Three issues:
1. Timeout was too short (6s) for slower APIs
2. Test treated 5xx as hard failures instead of recognizing API gateway reached
3. No special handling for NVIDIA's `nvapi-*` key format or custom auth headers

**Fixes Applied:**
- Increased timeout from 6s → 10s for slower providers
- Accepts 2xx-4xx as "connected" (server was reached, even if auth fails)
- Special error messages for 401/403 (key rejected) vs 5xx (server error)
- Custom headers from provider metadata applied to test request
- Detects `AbortError` separately for clear timeout messaging
- Updates `validation_status` after test runs

### 1.4 PTY SSE Stream Drops (terminal/pty/read/route.ts)

**Problem:** The SSE stream for PTY terminal output would disconnect unpredictably, especially after ~60s of inactivity.

**Root Cause:** No keepalive mechanism in the SSE response stream. Proxies, load balancers, and browser EventSource have idle timeouts (typically 30s-120s).

**Fixes Applied:**
- Added 15s heartbeat interval that sends `{ type: "heartbeat", ts: Date.now() }` JSON events
- Added `cancel()` handler to ReadableStream to clean up PTY on client disconnect
- Added `X-Accel-Buffering: no` header to prevent nginx buffering
- Added `Connection: keep-alive` and `Cache-Control: no-cache` headers

### 1.5 Zombie PTY Processes (cleanup/route.ts)

**Problem:** When users closed terminal tabs or navigated away, PTY processes were left running indefinitely (zombie processes).

**Fixes Applied:**
- Created new endpoint `POST /api/terminal/pty/cleanup` that safely kills PTY sessions
- Called automatically from `XtermTerminal` component's cleanup effect on unmount
- Idempotent — safe to call even for already-deleted sessions

---

## 2. Orchestration Refactoring

### 2.1 Tool Priority in System Prompt

**Goal:** Shift the assistant from terminal-first to file-first behavior.

**Before:** The Coding role prompt had generic instructions about being an AI assistant. The model would naturally default to using terminal commands for file operations.

**After:** Added explicit "Tool Priority" section to the Coding role's system prompt:

```
## Tool Priority (MANDATORY)

Always prefer direct file tools over terminal commands:

1. read_file — Read file contents directly
2. search_files — Search codebase for patterns
3. write_file — Write or edit files directly
4. renam_path — Rename files or folders
5. delete_path — Delete files or folders
6. search_web — Search the web for information
7. bash — Execute a shell command

IMPORTANT RULES:
- NEVER use bash to read a file. Use read_file.
- NEVER use bash to edit a file. Use write_file.
- NEVER use bash to search code. Use search_files.
- Use bash ONLY for: builds, tests, installs, git operations, and starting dev servers.
```

### 2.2 Claude Code-Style Tool Definitions

**Goal:** Adopt OpenClaude's tool architecture for the chat API route.

**Tools defined in chat/route.ts:**

| Tool | Description | Priority |
|---|---|---|
| `read_file` | Read file contents from disk | 1 (highest) |
| `write_file` | Create or overwrite files | 2 |
| `create_file` | Create a new file | 3 |
| `search_files` | Search codebase with include/pattern filtering | 4 |
| `rename_path` | Rename files/folders | 5 |
| `delete_path` | Delete files/folders | 6 |
| `search_web` | Web search for documentation | 7 |
| `execute_terminal` | Run shell commands | 8 (lowest - LAST RESORT) |

### 2.3 Multi-Role Routing

**Goal:** Route user requests to the appropriate model role.

**Roles implemented:**
- **Manager** — Orchestration, planning, breaking down complex tasks
- **Coding** — Code generation with Claude Code-style prompt (file-first)
- **Design** — UI/UX and visual design work
- **Research** — Web searches, analysis, data aggregation
- **Fast Inference** — Quick classification, simple responses
- **Vision** — Image understanding, screenshots, OCR

Routing logic uses **keyword detection** on user messages:
- Images → Vision role
- Questions about UI/design → Design role
- Research/analysis questions → Research role
- Simple questions → Fast Inference role
- Everything else → Coding role (Claude Code-style)

### 2.4 OpenClaude Patterns Adopted

| Pattern | OpenClaude Source | Our Implementation |
|---|---|---|
| Claude Code system prompt | `src/constants/prompts.ts` | `system-prompt-loader.ts` (Coding role) |
| Tool definitions | `src/tools/AgentTool/built-in/` | `chat/route.ts` tools object |
| Tool execution flow | `src/services/tools/toolExecution.ts` | `chat/route.ts` tool handlers |
| Role routing | `src/coordinator/` | `detectRole()` function |
| Security permissions | `src/tools/BashTool/bashPermissions.ts` | `security-guard.ts` + tool-level checks |
| SSE keepalive | `src/cli/transports/SSETransport.ts` (15s) | XtermTerminal + read/route.ts (15s) |

---

## 3. Architecture Decisions

### 3.1 Why Not Use the Full OpenClaude Stack?

OpenClaude is a CLI application built with Ink (React for terminal). Our Workspace is a web-based GUI using Next.js + shadcn/ui + Monaco Editor. The architectural differences:

| Aspect | OpenClaude | Our Workspace |
|---|---|---|
| Runtime | Node.js / Bun CLI | Next.js (Edge + Node) |
| UI Framework | Ink (terminal React) | React + shadcn/ui |
| State Management | Zustand + context | React context + hooks |
| Editor | None (terminal-based) | Monaco Editor |
| File System | Node.js `fs` | Next.js API routes |
| Terminal | Node PTY (Xterm.js) | Node PTY (Xterm.js) |

We extracted the **intelligence** (system prompts, tool definitions, security rules) and adapted it to our **GUI architecture** rather than trying to run OpenClaude inside a web view.

### 3.2 Remaining Differences from Cursor / Claude Desktop

| Feature | Cursor / Claude Desktop | Our Workspace | Status |
|---|---|---|---|
| File-first editing | ✅ Native | ✅ Via system prompt + tools | Done |
| Diff previews | ✅ Inline | ✅ Monaco DiffEditor | Done |
| Terminal integration | ✅ Full PTY | ✅ Xterm.js + PTY | Done |
| Multi-tab editing | ✅ Yes | ✅ Monaco tabs + split view | Done |
| File explorer | ✅ Native | ✅ Custom explorer | Done |
| Command palette (Ctrl+P) | ✅ Yes | ✅ QuickSearchDialog | Done |
| Status bar | ✅ Yes | ✅ StatusBar component | Done |
| Image attachments | ✅ Yes | ✅ Paste + drag-drop | Done |
| Context attachments | ✅ Yes | ✅ File chips | Done |
| Multi-model routing | ✅ Yes | ✅ Role-based routing | Done |
| Offline mode | ✅ Yes | ⚠️ Limited | Partial |
| Auto-complete (Tab) | ✅ Yes | ❌ Not implemented | Missing |
| Inline suggestions | ✅ Yes | ❌ Not implemented | Missing |
| Voice input | ✅ Claude Desktop | ❌ Not implemented | Missing |
| VS Code extension | ✅ Cursor | ❌ Not implemented | Missing |

---

## 4. File Changes Summary

| File | Status | Change |
|---|---|---|
| `apps/web/src/components/workspace/XtermTerminal.tsx` | **Modified** | Retry limit, debounced resize, heartbeat, auto-reconnect, cleanup |
| `apps/web/src/app/(dashboard)/workspace/page.tsx` | **Modified** | Fixed `useChat` → `DefaultChatTransport` for AI SDK v6 |
| `apps/web/src/app/api/terminal/pty/read/route.ts` | **Modified** | SSE heartbeat, cancel handler, proper headers |
| `apps/web/src/app/api/terminal/pty/cleanup/route.ts` | **NEW** | Zombie PTY process cleanup endpoint |
| `apps/web/src/lib/runtime/system-prompt-loader.ts` | **Modified** | Tool priority, Claude Code-style Coding prompt |
| `apps/web/src/app/api/settings/providers/[id]/test/route.ts` | **Modified** | 10s timeout, better error messages, custom headers |
| `apps/web/src/app/api/chat/route.ts` | **Modified** | Claude Code-style tool definitions, `detectRole()` routing |

---

## 5. Testing Results

- `npx tsc --noEmit -p apps/web/tsconfig.json` → **0 errors**

---

## 6. Known Issues

1. **AI SDK v6 transport API** — The `DefaultChatTransport` pattern works, but the `onFinish`, `onError`, and `sendAutomaticallyWhen` callbacks need to be passed separately (not inside transport options) for full streaming lifecycle integration
2. **Multiple custom providers** — The `provider_configs` table uses `provider` as the upsert conflict key, meaning only one "custom" provider. This should be changed to use a generated `id` field as the conflict key
3. **NVIDIA API header** — NVIDIA's `nvapi-*` keys require `NVCF-API-KEY` header instead of `Bearer`; the test endpoint doesn't detect this automatically yet
