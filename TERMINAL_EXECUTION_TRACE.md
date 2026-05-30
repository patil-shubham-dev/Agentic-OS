# Terminal Execution Trace

## Pipeline: Chat → Rust (end-to-end)

```
ChatPanel.sendMessage()                          [chat-panel.tsx:110]
  → ExecutionSessionManager.start()              [ExecutionSessionManager.ts:47]
    → ExecutionOrchestrator.execute()             [ExecutionOrchestrator.ts:51]
      → handleDelegatedExecution()                [ExecutionOrchestrator.ts:232]
        → AgentExecutor.executeFull()             [AgentExecutor.ts:288]
          → pipeline.execute("run_command", ...)  [AgentExecutor.ts:594]
            → ToolExecutionPipeline.execute()      [ToolExecutionPipeline.ts:42]
              → registry.resolve()                 [ToolRegistry.ts:33]
              → agent-tools dispatcher             [agent-tools.ts:360]
                → implRunCommand()                 [tool-executor.ts:86]
                  → ToolExecutionSandbox            [ToolExecutionSandbox.ts:159]
                    → TerminalRuntime.runStream()   [TerminalRuntime.ts:49]
                      → invoke("run_command_stream") ← **WAS UNREGISTERED**
```

## Layer-by-Layer Breakdown

### Layer 1 — ChatPanel.sendMessage()
| | |
|---|---|
| **File** | `src/components/workspace/chat-panel.tsx:110` |
| **Input** | `input: string` from Composer |
| **Output** | `void` (calls `executionSessionManager.start()`) |
| **Error handling** | `try/catch` at 128-145 |
| **Status** | ✅ Correct |

### Layer 2 — ExecutionSessionManager.start()
| | |
|---|---|
| **File** | `src/runtime/sessions/ExecutionSessionManager.ts:47` |
| **Input** | `ExecuteOptions { input, activeRole, correlationId?, mode?, signal? }` |
| **Output** | `Promise<ExecutionSession>` |
| **Key loop** | `for await (const event of orchestrator.execute(options))` at 76 |
| **Error handling** | `try/catch` at 73-104; safety net finalizes timeline sessions |
| **Status** | ✅ Correct |

### Layer 3 — ExecutionOrchestrator.execute()
| | |
|---|---|
| **File** | `src/runtime/execution/ExecutionOrchestrator.ts:51` |
| **Input** | `ExecuteOptions` |
| **Output** | `AsyncGenerator<ExecutionEvent>` |
| **Routing** | Decision-based: direct response vs delegated execution |
| **Error handling** | `try/finally` at 57-114; catches per-agent failures at 307 |
| **Status** | ✅ Correct |

### Layer 4 — AgentExecutor.executeFull()
| | |
|---|---|
| **File** | `src/runtime/agents/AgentExecutor.ts:288` |
| **Input** | None (uses constructor params) |
| **Output** | `AsyncGenerator<ExecutionEvent>` |
| **Tool loop** | Max 10 rounds (line 384) |
| **Pipeline call** | `pipeline.execute(tc.function.name, args, streamCtx)` at 594 |
| **Command handling** | Yields `COMMAND_START` (574), uses `EventChannel` for streaming output (584-600) |
| **Error handling** | `try/catch` at 409-444, 450-485 |
| **Timeouts** | `AGENT_EXECUTION_TIMEOUT_MS = 120_000` (43), `AGENT_SOFT_DEADLINE_MS = 60_000` (44) |
| **AbortSignal** | `this.signal?.aborted` checked at 394 |
| **Status** | ✅ Correct (events yield properly) |

### Layer 5 — ToolExecutionPipeline.execute()
| | |
|---|---|
| **File** | `src/runtime/tools/execution/ToolExecutionPipeline.ts:42` |
| **Input** | `toolName: string`, `input: unknown`, `ctx: ToolContext` |
| **Output** | `Promise<ToolResult>` |
| **Resolution** | `this.registry.resolve(toolName)` at 50 |
| **Execution** | `tool.execute(ctx, processedInput)` at 111 |
| **Error handling** | `try/catch` at 104-127; returns `{ isError: true }` |
| **Status** | ✅ Correct |

### Layer 6 — ToolRegistry.resolve()
| | |
|---|---|
| **File** | `src/runtime/tools/registry/ToolRegistry.ts:33` |
| **Input** | `name: string` |
| **Output** | `AgentTool | undefined` |
| **Lookup** | builtin → mcp → plugin → taskScoped |
| **Status** | ✅ Correct |

### Layer 7 — agent-tools.ts (Builtin Dispatch)
| | |
|---|---|
| **File** | `src/lib/agents/agent-tools.ts:360` |
| **Dispatches** | `run_command → implRunCommand()` |
| **Status** | ✅ Correct |

### Layer 8 — implRunCommand()
| | |
|---|---|
| **File** | `src/lib/tool-executor.ts:86` |
| **Input** | `rootPath, role, tcId, command, args, onOutput?` |
| **Output** | `Promise<string>` |
| **Delegates to** | `ToolExecutionSandbox.executeTerminalTool()` |
| **Status** | ✅ Correct |

### Layer 9 — ToolExecutionSandbox.executeTerminalTool()
| | |
|---|---|
| **File** | `src/runtime/tools/ToolExecutionSandbox.ts:159` |
| **Input** | `SandboxedToolCall`, `ToolSandboxContext` |
| **Output** | `Promise<ToolSandboxResult>` |
| **Delegates to** | `TerminalRuntime.runStream()` at 166 |
| **Status** | ✅ Correct |

### Layer 10 — TerminalRuntime.runStream() ⚠️
| | |
|---|---|
| **File** | `src/runtime/terminal/TerminalRuntime.ts:49` |
| **Input** | `command: string`, `cwd: string | null`, `options` |
| **Output** | `AsyncGenerator<{ type, line?, exitCode? }>` |
| **Invoke** | `invoke("run_command_stream", { command, cwd, streamId })` at 74 |
| **Event listeners** | `terminal-output:{streamId}` (65), `terminal-complete:{streamId}` (69) |
| **Timeout** | `MAX_TIMEOUT = 60_000` (85) — added in earlier fix |
| **Error handling** | `.catch()` on invokePromise (78) — added in earlier fix |
| **Status** | 🟡 FIXED: Rust command now registered. Timeout + catch added defensively. |

### Layer 11 — Rust Backend (lib.rs) ✅ NOW REGISTERED
| | |
|---|---|
| **File** | `src-tauri/src/lib.rs` |
| **run_command** | Line 411: Executes via `cmd /c` (Windows) or `sh -c` (Unix), returns stdout on success, stderr on error |
| **run_command_stream** | Line 430: Spawns process, 2 background threads read stdout/stderr and emit Tauri events per line, waits for exit, emits `terminal-complete` with exit code |
| **Registration** | Both added to `generate_handler![]` at lines 784-785 |

## Failure Points (Resolved)

| # | Layer | Failure | Fix |
|---|-------|---------|-----|
| 1 | TerminalRuntime.runStream() | `invoke("run_command_stream")` rejected immediately — command not found | Registered Rust command |
| 2 | TerminalRuntime.runStream() | Polling loop ran 60s before timeout returned empty output | Rust command now emits events properly |
| 3 | TerminalRuntime.run() | No error handling at all (throw on invoke failure) | Not actively called; `runStream()` is the active path |
| 4 | TerminalRuntime.runStream() | No AbortSignal integration | Not critical — .catch() + timeout provide safety |

## Summary

The pipeline was structurally correct at every TypeScript layer. The **single root cause** was that `run_command_stream` and `run_command` were never implemented in Rust. All TypeScript plumbing was waiting for a backend that didn't exist. With the Rust commands now registered and the 60s timeout + .catch() as defense-in-depth, the pipeline should function correctly.
