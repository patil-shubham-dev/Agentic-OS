import { useEffect, useRef, useCallback, useState } from "react"
import { EventBus, type RuntimeEvent } from "@/runtime/render-engine/event-bus"
import { useWorkspaceStore } from "@/stores/workspace-store"

/**
 * Regex to detect code block openings with file path annotations.
 * Matches ```language:path/to/file or ```:path/to/file or ```path/to/file
 */
const CODE_BLOCK_FILE_RE = /^```(\w+)?\s*[:：]\s*(.+)$/m

/**
 * Hook that monitors TOKEN_STREAM events from the EventBus and
 * live-streams AI-generated file content directly into open editor tabs.
 *
 * The system works by:
 * 1. Accumulating a rolling buffer of the last N tokens
 * 2. Detecting code blocks with file path annotations (e.g. ```typescript:src/foo.ts)
 * 3. When a buffered code block for a known open file is detected, pushing
 *    content updates into the workspace store, which triggers Monaco re-render
 *
 * This gives the user a Cursor/Claude-Code-style experience where
 * generated code appears in the editor in real-time as the AI writes it.
 */
export function useLiveEditorStream(): {
  liveStreamActive: boolean
  liveEditingFile: string | null
  streamProgress: number      // 0–1 ratio of estimated completion for the current code block
  sessionTokens: number       // Total TOKEN_STREAM events received this session
  sessionChars: number        // Total characters streamed this session
} {
  const bufferRef = useRef<string>("")
  const activeCodeBlockRef = useRef<{
    filePath: string
    content: string
    language: string
  } | null>(null)
  const storedOpenFilesRef = useRef(useWorkspaceStore.getState().openFiles)
  const lastUpdateTimeRef = useRef(0)
  const UPDATE_THROTTLE_MS = 150

  // Reactive state so the UI can show an "AI writing..." indicator
  const [liveStreamActive, setLiveStreamActive] = useState(false)
  const [liveEditingFile, setLiveEditingFile] = useState<string | null>(null)
  const [streamProgress, setStreamProgress] = useState(0)

  // Refs for progress tracking (updated in handler, state set on throttle)
  const streamedCharsRef = useRef(0)
  const progressThrottleRef = useRef(0)
  const PROGRESS_THROTTLE_MS = 200

  // Session-level rolling counters (accumulate across all code blocks)
  const sessionTokensRef = useRef(0)
  const sessionCharsRef = useRef(0)
  const [sessionTokens, setSessionTokens] = useState(0)
  const [sessionChars, setSessionChars] = useState(0)
  const sessionThrottleRef = useRef(0)
  const SESSION_THROTTLE_MS = 400

  // Keep openFiles ref up to date
  useEffect(() => {
    const unsub = useWorkspaceStore.subscribe((state) => {
      storedOpenFilesRef.current = state.openFiles
    })
    return () => unsub()
  }, [])

  const pushToEditor = useCallback((filePath: string, content: string, isFinal: boolean = false) => {
    const now = Date.now()
    if (!isFinal && now - lastUpdateTimeRef.current < UPDATE_THROTTLE_MS) return
    if (!isFinal) lastUpdateTimeRef.current = now

    const state = useWorkspaceStore.getState()
    const openFile = state.openFiles.find((f) => f.path === filePath)

    // Only stream if the file is actually open in an editor tab
    if (openFile) {
      // During live streaming, update content without marking dirty
      // Only mark dirty on the final write
      const updatedFiles = state.openFiles.map((f) =>
        f.path === filePath ? { ...f, content, isDirty: isFinal } : f
      )
      useWorkspaceStore.setState({ openFiles: updatedFiles })
    }
  }, [])

  useEffect(() => {
    const bus = EventBus.getInstance()

    const handler = (event: RuntimeEvent) => {
      if (event.type !== "TOKEN_STREAM") return

      const token = event.token

      // Accumulate session-level counters on every single token
      sessionTokensRef.current += 1
      sessionCharsRef.current += token.length
      // Throttled state updates to avoid flooding React renders during rapid streaming
      const sessNow = Date.now()
      if (sessNow - sessionThrottleRef.current >= SESSION_THROTTLE_MS) {
        sessionThrottleRef.current = sessNow
        setSessionTokens(sessionTokensRef.current)
        setSessionChars(sessionCharsRef.current)
      }
      bufferRef.current += token

      // Only keep the last ~8KB of buffer for code block detection
      if (bufferRef.current.length > 8192) {
        bufferRef.current = bufferRef.current.slice(-4096)
      }

      // Check if we're currently inside a code block
      if (activeCodeBlockRef.current) {
        const block = activeCodeBlockRef.current

        // Check for closing fence
        if (token.includes("```") || token.includes("```\n") || /\n```/.test(block.content + token)) {
          // Code block ended — close it
          const fullContent = block.content + token
          const closeIdx = fullContent.indexOf("```")
          if (closeIdx >= 0) {
            const finalContent = fullContent.slice(0, closeIdx).trimEnd()
            if (finalContent.length > 0) {
              pushToEditor(block.filePath, finalContent, true)
            }
          }
          activeCodeBlockRef.current = null
          setLiveStreamActive(false)
          setLiveEditingFile(null)
          setStreamProgress(1)
          bufferRef.current = ""
          return
        }

        // Accumulate content
        block.content += token
        streamedCharsRef.current += token.length

        // Throttled progress updates — estimate completion based on char count
        // The target is a soft estimate: we assume most code blocks are ≤ 4000 chars
        // so the bar fills to ~85% during streaming, jumping to 100% on close
        const now = Date.now()
        if (now - progressThrottleRef.current >= PROGRESS_THROTTLE_MS) {
          progressThrottleRef.current = now
          const chars = streamedCharsRef.current
          const estimatedProgress = chars >= 8000
            ? 0.85 + Math.min((chars - 8000) / 20000, 0.1)  // slow crawl after 8K chars
            : chars / 4000 * 0.85  // linear fill up to 85% for first 4K chars
          setStreamProgress(Math.min(estimatedProgress, 0.92))
        }

        // Push updates to editor periodically (throttled)
        if (block.content.length > 20) {
          // Trim any trailing fence that might be mid-stream
          const cleanContent = block.content.replace(/```[\s\S]*$/, "").trim()
          if (cleanContent.length > 0) {
            pushToEditor(block.filePath, cleanContent)
          }
        }
        return
      }

      // Check for code block opening with file path
      if (bufferRef.current.includes("```")) {
        // Try to find a code block annotation that specifies a file path
        // Look for patterns like ```language:path in recent buffer
        // Use a generous window to handle long AI preambles before code blocks
        const recent = bufferRef.current.slice(-800)
        const match = CODE_BLOCK_FILE_RE.exec(recent)
        if (match) {
          const language = match[1] ?? ""
          const filePath = match[2].trim()

          // Normalize the file path
          const normalizedPath = filePath.replace(/^[`\s]+/, "").replace(/[`\s]+$/, "")

          // Verify this file is open in the workspace
          const isOpen = storedOpenFilesRef.current.some((f) => f.path === normalizedPath)
          if (isOpen && normalizedPath.length > 0) {
            // Start accumulating code block content
            const afterFence = recent.slice(recent.indexOf("```") + 3 + (language ? language.length + 1 : 0) + filePath.length)
            activeCodeBlockRef.current = {
              filePath: normalizedPath,
              content: afterFence,
              language,
            }
            setLiveStreamActive(true)
            setLiveEditingFile(normalizedPath)
            setStreamProgress(0)
            streamedCharsRef.current = 0
          }
        }
      }
    }

    bus.on("TOKEN_STREAM", handler)

    return () => {
      bus.off("TOKEN_STREAM", handler)
      activeCodeBlockRef.current = null
      setLiveStreamActive(false)
      setLiveEditingFile(null)
      setStreamProgress(0)
      // Flush final session counters on unmount
      setSessionTokens(sessionTokensRef.current)
      setSessionChars(sessionCharsRef.current)
    }
  }, [pushToEditor])

  return {
    liveStreamActive,
    liveEditingFile,
    streamProgress,
    sessionTokens,
    sessionChars,
  }
}
