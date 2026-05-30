# TIMEOUT VALIDATION REPORT

> Generated: 2026-05-30
> Scope: All 148 async operations in AgenticOS

---

## EXECUTIVE SUMMARY

**23 of 148** async operations have explicit timeouts (15.5%).

**~40 operations** have NO timeout, NO error handler, NO retry (27%).

**4 operations** have the full stack: timeout + error handler + retry.

---

## OPS WITH TIMEOUTS (23)

| # | Operation | Timeout | Location |
|---|-----------|---------|----------|
| 1 | AgentExecutor hard timeout | 120s | AgentExecutor.ts:391-393 |
| 2 | AgentExecutor soft deadline | 60s | AgentExecutor.ts:44,387 |
| 3 | TerminalRuntime.runStream | 60s | TerminalRuntime.ts:85 |
| 4 | Sub-agent timeout | 60s | sub-agent-delegator.ts:174,328-329 |
| 5 | Approval gate timeout | 60s | approval-gate.ts:37 |
| 6 | PostWriteVerifier terminal | 60s | PostWriteVerifier.ts (via TerminalRuntime) |
| 7 | Force-stop cleanup | 5s | ExecutionSessionManager.ts:459 |
| 8 | withTimeout generic | 5s (default) | with-timeout.ts:10 |
| 9 | withTimeoutFallback | 5s (default) | with-timeout.ts:33 |
| 10 | Ollama detection | 2s | onboarding.tsx:45 |
| 11 | Workspace-store loading guard | 30s | workspace-store.ts:282 |
| 12 | MCP health check interval | 30s | MCPServerManager.ts:42 |
| 13 | Context refresh defer | 3s | runtime-coordinator.ts:64 |
| 14 | PostWriteVerifier cooldown | 2s | PostWriteVerifier.ts:32 |
| 15 | Completion debounce | 400ms | completion-provider.ts:177 |

---

## COMPLETELY UNPROTECTED OPS (~40)

These have NO timeout, NO error handler, NO retry. They will hang forever if the backend hangs.

### CRITICAL — User-facing hangs

| # | Operation | Impact |
|---|-----------|--------|
| 1 | All git operations (gitStatus, gitLog, gitDiff, gitCommit, gitRestore, gitPush, gitPull, gitBranchList, gitCheckout) | User clicks git button → infinite spinner |
| 2 | All browser operations (launchBrowser, navigate, screenshot, executeJs, getUrl, getTitle, closeBrowser, browserClick, browserFill, browserWait) | Agent hangs on browser tool |
| 3 | All workspace file operations (loadFileTree, readFile, createFile, createFolder, deleteEntry, renameEntry) | File tree never loads, file operations stuck |
| 4 | All MCP transport send() calls (Stdio, SSE, WebSocket, HTTP) | Tool execution hangs |
| 5 | Start file watcher | Watcher never starts |
| 6 | Debugger operations (startSession, stopSession, resume, stepOver, stepInto, stepOut) | Debug session hangs |

### HIGH — Common operations

| # | Operation | Impact |
|---|-----------|--------|
| 7 | ToolExecutionPipeline.execute() — actual tool.run() | Tool execution hangs indefinitely |
| 8 | AgentExecutor.memoryLoader.load() — project memory | Memory loading hangs |
| 9 | executeSubAgentTools() — sub-agent tool execution | Sub-agent hangs |
| 10 | attemptStreamingRound() in sub-agent | LLM call hangs |
| 11 | RuntimeOS.initialize() — MCP connectAll | App never starts |
| 12 | RuntimeOS.shutdown() — MCP disconnectAll | App never closes |
| 13 | handleDirectResponse → fastChatCompletion | LLM response hangs |
| 14 | handleDelegatedExecution → AgentExecutor | Agent execution hangs |
| 15 | SynthesisEngine.synthesize() | Final synthesis hangs |
| 16 | AI edit service | Code edit hangs |
| 17 | Grep file reads (binary files) | Search hangs |
| 18 | Provider gateway operations | Provider hangs |
| 19 | Transport streaming (all 4 transport types) | Streaming hangs |
| 20 | CDP client operations (connect, send, setBreakpoint, etc.) | Debugging hangs |

---

## CRITICAL GAPS

### Gap 1: No network timeout on any git operation
All 9 git operations use `invoke()` without timeout. Git operations over SSH/HTTPS can hang on:
- Host resolution failure (DNS timeout: 10-30s OS default)
- Connection timeout (TCP timeout: 21s OS default)
- SSH authentication prompt (indefinite)
- Large repo operations (diff, log on monorepo with 100k+ commits)

**Impact:** Every git button in the UI can produce an infinite spinner.

### Gap 2: No timeout on tool.execute() 
ToolExecutionPipeline.execute() calls `tool.execute(ctx, input)` at line 111 with NO timeout. If a tool hangs (e.g., file read on locked file, terminal command on infinite loop without proper timeout), the entire agent execution freezes. The AgentExecutor 120s hard timeout will eventually kill it, but that's a coarse-grained safety net, not a per-operation timeout.

### Gap 3: No timeout on file reads
`grepFiles()` in search-utils.ts calls `tauri-plugin-fs` `readTextFile()` without timeout. Large binary files could cause the filesystem read to hang indefinitely.

### Gap 4: No timeout on MCP transport connections
`StdioMCPTransport.connect()`, `SSEMCPTransport.connect()`, `WebSocketMCPTransport.connect()` all have NO timeout. If the MCP server process never spawns, or the SSE endpoint never responds, the connection hangs forever.

### Gap 5: No timeout on browser automation
11 browser operations have no error handling at all — they invoke Tauri commands that don't exist. The error message is a silent `undefined`.

### Gap 6: "undefined" error messages in 8/11 failure paths
Most catch blocks use `err instanceof Error ? err.message : String(err)`. A `throw undefined` or `throw null` upstream produces the literal string "undefined" in the UI.

---

## VERDICT

**FAIL.** The timeout coverage is incomplete in dangerous ways.

- Every git operation can produce an infinite spinner.
- Every tool execution can lock up the entire agent.
- Every file read during search can hang.
- Every MCP connection can block startup.

Without per-operation timeouts, a single hanging backend call freezes the user experience.
