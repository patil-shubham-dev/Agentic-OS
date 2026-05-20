"use client";

import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

interface XtermTerminalProps {
  id: string;
  cwd: string;
  onExit?: (code: number) => void;
}

export default function XtermTerminal({ id, cwd, onExit }: XtermTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const container = terminalRef.current;
    if (!container) return;

    // Helper to initialize terminal once container has valid dimensions
    const initTerminal = () => {
      if (!terminalRef.current) return;
      const rect = terminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Retry on next animation frame when layout may be ready
        requestAnimationFrame(initTerminal);
        return;
      }

      const term = new Terminal({
        cursorBlink: true,
        theme: {
          background: "#0f172a",
          foreground: "#f8fafc",
          cursor: "#10b981",
        },
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 12,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);

      // Fit after terminal is attached to DOM
      requestAnimationFrame(() => {
        try {
          fitAddon.fit();
        } catch (error) {
          console.error("xterm fit failed:", error);
        }
      });

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      // Connect to PTY EventSource endpoint for reading
      const es = new EventSource(`/api/terminal/pty/read?id=${id}&cwd=${encodeURIComponent(cwd)}`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        term.writeln("\x1b[32m[AgentOS PTY Connected]\x1b[0m");
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "data") {
            term.write(payload.data);
          } else if (payload.type === "exit") {
            term.writeln(`\r\n\x1b[31m[Process exited with code ${payload.exitCode.exitCode}]\x1b[0m`);
            if (onExit) onExit(payload.exitCode.exitCode);
          }
        } catch (e) {
          term.write(event.data);
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        term.writeln("\r\n\x1b[31m[AgentOS PTY Disconnected]\x1b[0m");
        es.close();
        if (onExit) onExit(1);
      };

      term.onData((data) => {
        if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN) {
          fetch("/api/terminal/pty/write", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, data })
          }).catch(console.error);
        }
      });

      // Resize handling with guard and observer
      const handleResize = () => {
        if (!fitAddonRef.current) return;
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          console.error("xterm resize fit failed:", e);
        }
        if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN) {
          fetch("/api/terminal/pty/resize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, cols: term.cols, rows: term.rows })
          }).catch(console.error);
        }
      };

      const resizeObserver = new ResizeObserver(() => {
        // Ensure container still has size before fitting
        const r = terminalRef.current?.getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) {
          handleResize();
        }
      });
      resizeObserver.observe(terminalRef.current);

      window.addEventListener("resize", handleResize);

      // Cleanup
      return () => {
        resizeObserver.disconnect();
        window.removeEventListener("resize", handleResize);
        es.close();
        term.dispose();
      };
    };

    // Kick off initialization
    initTerminal();
  }, [id, cwd, onExit]);
  return (
    <div className="w-full h-full p-2 bg-slate-900 overflow-hidden relative">
      {!isConnected && (
        <div className="absolute top-2 right-4 z-10 flex items-center gap-2 text-[10px] text-amber-500 bg-slate-800 px-2 py-1 rounded">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Connecting to PTY backend...
        </div>
      )}
      <div ref={terminalRef} className="w-full h-full min-h-[400px]" />
    </div>
  );
}
