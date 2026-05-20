"use client";

import { memo, Suspense, lazy } from "react";
import type { DiffEditorProps } from "@monaco-editor/react";

const MonacoDiffEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.DiffEditor }))
);

function DiffEditorFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-900">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span className="text-[10px] text-slate-400">Loading diff editor...</span>
      </div>
    </div>
  );
}

export const LazyDiffEditor = memo(function LazyDiffEditor(props: DiffEditorProps) {
  return (
    <Suspense fallback={<DiffEditorFallback />}>
      <MonacoDiffEditor {...props} />
    </Suspense>
  );
});
