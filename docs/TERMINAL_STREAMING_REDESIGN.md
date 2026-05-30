# TERMINAL STREAMING REDESIGN

## Current Problem

When a command runs, users see:

```
┌─ Tool Card ──────────────────────────┐
│  run_command                          │
│  $ npm run build                      │
│  [loading...]                         │
│  ✓ Completed in 3.2s                  │
└───────────────────────────────────────┘
```

Problems:
- Internal tool name visible
- No live output during execution
- Silent waiting period
- Tool card wrapper adds chrome
- Frozen state until completion

## Target

```
Running npm build...

  $ npm run build
  > agentic-os@1.0.0 build
  > vite build
  
  ✓ building...
  ✓ transforming...
  ✓ rendering...
  
  ✓ Completed in 3.2s
```

Live output streaming. No wrapper. No tool names.

## Design

### Stream Mode

During command execution, output streams live into the conversation:

```typescript
interface TerminalStreamConfig {
  // Show live output inline in the conversation
  inline: true
  // Scroll behavior
  autoScroll: true
  // Max lines before collapse
  maxLines: 100
  // Show on new line, not inside a card
  fullWidth: true
}
```

### Component: LiveTerminalOutput

```typescript
// src/components/workspace/timeline/conversation/LiveTerminalOutput.tsx

function LiveTerminalOutput({ command, streamId }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [status, setStatus] = useState<"running" | "success" | "error">("running")
  const [duration, setDuration] = useState(0)
  const startTime = useRef(Date.now())

  // Subscribe to streaming bus for this command
  useEffect(() => {
    const unsub = streamingBus.subscribe(streamId, (output) => {
      setLines(output.split("\n"))
    })
    return unsub
  }, [streamId])

  // Duration ticker
  useEffect(() => {
    if (status !== "running") return
    const id = setInterval(() => setDuration(Date.now() - startTime.current), 100)
    return () => clearInterval(id)
  }, [status])

  return (
    <div className="terminal-stream">
      {lines.length === 0 ? (
        <div className="terminal-pending">
          <ActivityDot /> {command}
        </div>
      ) : (
        <>
          <div className="terminal-header">$ {command}</div>
          <pre className="terminal-output">
            {lines.map((line, i) => (
              <span key={i} className="terminal-line">{line}</span>
            ))}
          </pre>
          {status === "running" && (
            <div className="terminal-duration">
              <ActivityDot /> Running... {(duration / 1000).toFixed(1)}s
            </div>
          )}
        </>
      )}
      {status === "success" && (
        <div className="terminal-complete">
          ✓ Completed in {(duration / 1000).toFixed(1)}s
        </div>
      )}
      {status === "error" && (
        <div className="terminal-error">
          ✗ Failed with exit code {exitCode} ({(duration / 1000).toFixed(1)}s)
        </div>
      )}
    </div>
  )
}
```

### Integration with Activity Timeline

```
┌──────────────────────────────────────────────┐
│  ◌ Understanding request                     │
│  ◌ Planning approach                         │
│  ● Running npm build...                      │
│                                              │
│    $ npm run build                           │
│    > agentic-os@1.0.0 build                  │
│    > vite build                              │
│    ✓ building...                             │
│    ✓ transforming...                          │
│    ✓ rendering...                             │
│                                              │
│    ✓ Completed in 3.2s                       │
│                                              │
│  ◌ Finalizing response                       │
└──────────────────────────────────────────────┘
```

### Streaming Architecture

```
Command execution
  → ToolExecutionPipeline.execute("run_command")
    → PtySession.spawn() / Tauri Command
      → stdout/stderr chunks
      → streamingBus.append(streamId, chunk)
        → LiveTerminalOutput subscriber
          → Append to pre element (DOM direct)
  → Command completes
    → streamingBus.commit(streamId)
    → LiveTerminalOutput shows status
```

### No More Tool Cards

Remove the tool card wrapper entirely:

```typescript
// Before: AgentExecutor.ts yields TOOL_START → rendered as card
yield {
  type: "TOOL_START",
  executionId,
  toolName: "run_command",  // ← visible in UI
  args: "{command: 'npm run build'}",  // ← visible in UI
}

// After: AgentExecutor yields COMMAND_ACTIVITY
yield {
  type: "COMMAND_ACTIVITY",
  executionId,
  command: "npm run build",
  streamId: "cmd_abc123",
  status: "running",
}

// UI renders as inline terminal output, not a card
```

### State Transitions

```
COMMAND_ACTIVITY { status: "running" }
  → Show "$ command" + activity dot
  → On each chunk: append to output
  → Elapsed timer ticks

COMMAND_ACTIVITY { status: "output", text: "..." }
  → Append text to output

COMMAND_ACTIVITY { status: "success", exitCode: 0, durationMs: 3200 }
  → Stop timer
  → Show "✓ Completed in 3.2s"
  → Activity gets checkmark

COMMAND_ACTIVITY { status: "error", exitCode: 1, error: "..." }
  → Stop timer
  → Show "✗ Failed with exit code 1"
  → Show error output
  → Activity shows error state
```

### Visual Style

```css
.terminal-stream {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 8px 0;
}

.terminal-header {
  color: var(--terminal-green);
  margin-bottom: 4px;
}

.terminal-output {
  overflow-x: auto;
  white-space: pre;
  color: var(--foreground-muted);
}

.terminal-line {
  display: block;
}

.terminal-duration {
  color: var(--foreground-muted);
  font-size: 12px;
  margin-top: 8px;
}

.terminal-complete {
  color: var(--success);
  font-size: 12px;
  margin-top: 8px;
}

.terminal-error {
  color: var(--error);
  font-size: 12px;
  margin-top: 8px;
}

.terminal-pending {
  color: var(--foreground-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}
```

### Migration

1. Add `COMMAND_ACTIVITY` event type to `ExecutionEvent.ts`
2. Create `LiveTerminalOutput` component
3. Wire `streamingBus` subscription in `LiveTerminalOutput`
4. Remove tool card rendering for commands
5. Add command output to `ResponseStream` or `StreamingBus`
6. Remove `run_command` name exposure
