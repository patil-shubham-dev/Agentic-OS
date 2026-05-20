"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
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
  const initAttempts = useRef(0);
  const MAX_RETRIES = 50;
  const mountedRef = useRef(true);

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const container = terminalRef.current;
    if (!container) return;

    const initTerminal = () => {
      if (!mountedRef.current) return;
      if (!terminalRef.current) return;
      const rect = terminalRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        initAttempts.current++;
        if (initAttempts.current >= MAX_RETRIES) {
          console.warn("[XtermTerminal] Max retries reached — container never got dimensions");
          return;
        }
        setTimeout(initTerminal, 100);
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
        allowTransparency: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);

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

      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        term.writeln("\x1b[32m[AgentOS PTY Connected]\x1b[0m");

        // Start heartbeat: send empty data ping every 15s so the SSE stream stays alive
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN) {
            fetch("/api/terminal/pty/write", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, data: "" })
            }).catch(() => {});
          }
        }, 15_000);
      };

      es.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "data") {
            term.write(payload.data);
          } else if (payload.type === "exit") {
            term.writeln(`\r\n\x1b[31m[Process exited with code ${payload.exitCode.exitCode}]\x1b[0m`);
            if (onExit) onExit(payload.exitCode.exitCode);
            // Keep the terminal visible but don't reconnect
            setIsConnected(false);
          } else if (payload.type === "heartbeat") {
            // SSE keepalive — ignore, just confirms connection is alive
          }
        } catch (e) {
          term.write(event.data);
        }
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        term.writeln("\r\n\x1b[31m[AgentOS PTY Disconnected — will retry]\x1b[0m");
        es.close();
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        // Auto-reconnect after 2s
        reconnectTimer = setTimeout(() => {
          if (mountedRef.current && eventSourceRef.current) {
            const newEs = new EventSource(`/api/terminal/pty/read?id=${id}&cwd=${encodeURIComponent(cwd)}`);
            eventSourceRef.current = newEs;
          }
        }, 2000);
      };

      term.onData((data) => {
        if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN) {
          fetch("/api/terminal/pty/write", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, data })
          }).catch(() => {});
        }
      });

      // Resize handling — debounced with size check guard
      const handleResize = () => {
        if (!fitAddonRef.current || !xtermRef.current) return;
        const r = terminalRef.current?.getBoundingClientRect();
        if (!r || r.width === 0 || r.height === 0) return;
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          console.error("xterm resize fit failed:", e);
        }
        const t = xtermRef.current;
        if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN) {
          fetch("/api/terminal/pty/resize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, cols: t.cols, rows: t.rows })
          }).catch(() => {});
        }
      };

      // Debounced resize to avoid rapid-fire calls
      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      const debouncedResize = () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(handleResize, 150);
      };

      const resizeObserver = new ResizeObserver(() => {
        debouncedResize();
      });
      resizeObserver.observe(terminalRef.current);

      window.addEventListener("resize", debouncedResize);

      // Cleanup
      const cleanup = () => {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeObserver.disconnect();
        window.removeEventListener("resize", debouncedResize);
        es.close();
        term.dispose();
        eventSourceRef.current = null;
        // Tell server to clean up PTY session
        fetch("/api/terminal/pty/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        }).catch(() => {});
      };

      // Store cleanup on container
      (terminalRef.current as any).__xtermCleanup = cleanup;
    };

    initTerminal();

    return () => {
      if (terminalRef.current && (terminalRef.current as any).__xtermCleanup) {
        (terminalRef.current as any).__xtermCleanup();
      }
    };
  }, [id, cwd, onExit]);

  return (
    <div className="w-full h-full p-2 bg-slate-900 overflow-hidden relative">
      {!isConnected && (
        <div className="absolute top-2 right-4 z-10 flex items-center gap-2 text-[10px] text-amber-500 bg-slate-800 px-2 py-1 rounded shadow">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Connecting to PTY backend...
        </div>
      )}
      <div ref={terminalRef} className="w-full h-full min-h-[400px]" />
    </div>
  );
}
