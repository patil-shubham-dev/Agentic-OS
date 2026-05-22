"use client";

import { useEffect, useState } from "react";

interface ErrorFallbackProps {
  error?: Error | null;
  reset?: () => void;
  title?: string;
  description?: string;
  showReset?: boolean;
}

export function ErrorFallback({
  error,
  reset,
  title = "Something went wrong",
  description = "An unexpected error occurred. This has been logged.",
  showReset = true,
}: ErrorFallbackProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    console.error("[ErrorFallback]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
      <div className="max-w-md space-y-4">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <svg
              className="w-6 h-6 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        </div>
        <h3 className="text-sm font-semibold text-[--text-primary]">{title}</h3>
        <p className="text-xs text-[--text-muted]">{description}</p>
        {error && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-[--accent-primary] hover:text-[--accent-hover] underline underline-offset-2"
            >
              {expanded ? "Hide details" : "Show details"}
            </button>
            {expanded && (
              <pre className="mt-2 p-3 rounded-lg bg-[--bg-tertiary] border border-[--border-primary] text-xs text-left text-[--text-muted] font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            )}
          </div>
        )}
        {showReset && reset && (
          <button
            onClick={reset}
            className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-[--accent-primary] text-white hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

export function StoreErrorFallback({
  storeName,
  onReset,
}: {
  storeName: string;
  onReset?: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
      <p className="text-xs font-medium text-amber-400">
        {storeName} encountered an error
      </p>
      <p className="text-[10px] text-[--text-muted] mt-1">
        This section has been isolated. Other features remain unaffected.
      </p>
      {onReset && (
        <button
          onClick={onReset}
          className="mt-2 px-3 py-1 text-[10px] font-medium rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20"
        >
          Reset {storeName}
        </button>
      )}
    </div>
  );
}
