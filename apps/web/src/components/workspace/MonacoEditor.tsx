"use client";

import { memo, Suspense, lazy, useEffect, useState } from "react";
import { type EditorProps } from "@monaco-editor/react";

const MonacoEditor = lazy(() => import("@monaco-editor/react").then((mod) => ({ default: mod.default })));

function EditorFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-900">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span className="text-[10px] text-slate-400">Loading editor...</span>
      </div>
    </div>
  );
}

export const LazyEditor = memo(function LazyEditor(props: EditorProps) {
  return (
    <Suspense fallback={<EditorFallback />}>
      <MonacoEditor {...props} />
    </Suspense>
  );
});
