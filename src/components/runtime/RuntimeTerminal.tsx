import { useEffect, useRef, useState, useCallback } from "react"

interface TerminalLine {
  id: string
  text: string
  type: "input" | "output" | "error" | "system" | "ansi"
  timestamp: number
}

interface RuntimeTerminalProps {
  bufferSize?: number
  initialLines?: TerminalLine[]
}

function parseAnsi(text: string): string {
  // Strip ANSI escape codes using ESC character (0x1B)
  const esc = String.fromCharCode(27)
  return text.replace(new RegExp(`${esc}\\[[0-9;]*[a-zA-Z]`, 'g'), "")
}

export function RuntimeTerminal({ bufferSize = 500, initialLines = [] }: RuntimeTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>(initialLines)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const bottomRef = useRef<HTMLDivElement>(null)
  const lineIdCounter = useRef(0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines.length])

  const write = useCallback((text: string, type: TerminalLine["type"] = "output") => {
    const id = `term-${++lineIdCounter.current}-${Date.now()}`
    setLines((prev) => {
      const next = [...prev, { id, text: parseAnsi(text), type, timestamp: Date.now() }]
      return next.length > bufferSize ? next.slice(next.length - bufferSize) : next
    })
  }, [bufferSize])

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const typeColors: Record<TerminalLine["type"], string> = {
    input: "#a78bfa",
    output: "#e2e8f0",
    error: "#f87171",
    system: "#34d399",
    ansi: "#fbbf24",
  }

  const typePrefixes: Record<TerminalLine["type"], string> = {
    input: "$ ",
    output: "",
    error: "✗ ",
    system: "◆ ",
    ansi: "",
  }

  const outputGroups = lines.reduce<{ lines: TerminalLine[]; collapsed: string | null }[]>((acc, line) => {
    if (line.type === "input") {
      acc.push({ lines: [line], collapsed: null })
    } else if (acc.length > 0) {
      const last = acc[acc.length - 1]
      if (last.collapsed === null) {
        last.collapsed = line.type === "output" ? line.id : null
      }
      last.lines.push(line)
    } else {
      acc.push({ lines: [line], collapsed: line.type === "output" ? line.id : null })
    }
    return acc
  }, [])

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: "13px",
      lineHeight: "1.5",
      backgroundColor: "#0d1117",
      color: "#e2e8f0",
      height: "100%",
      overflow: "auto",
      padding: "12px",
    }}>
      {outputGroups.map((group) => {
        const isCollapsed = group.collapsed !== null && collapsed.has(group.collapsed!)
        return (
          <div key={group.lines[0]?.id ?? "empty"}>
            {group.lines.map((line, li) => {
              const hidden = li > 0 && isCollapsed && li <= 3
              if (hidden) return null
              if (li === 1 && isCollapsed) {
                return (
                  <div
                    key="collapsed"
                    onClick={() => group.collapsed && toggleCollapse(group.collapsed)}
                    style={{ cursor: "pointer", color: "#6b7280", fontSize: "12px" }}
                  >
                    ... {group.lines.length - 1} more lines
                  </div>
                )
              }
              return (
                <div
                  key={line.id}
                  style={{
                    color: typeColors[line.type],
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    minHeight: "18px",
                  }}
                >
                  {typePrefixes[line.type]}
                  {line.text}
                </div>
              )
            })}
            {isCollapsed && (
              <div
                onClick={() => group.collapsed && toggleCollapse(group.collapsed)}
                style={{ cursor: "pointer", color: "#6b7280", fontSize: "12px" }}
              >
                ▲ collapse
              </div>
            )}
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}

export type { TerminalLine }
