"use client";

import { memo, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Upload } from "lucide-react";

interface FileDropzoneProps {
  onDrop: (files: File[]) => void;
  isDragActive?: boolean;
}

function FileDropzoneInner({ onDrop: onDropCallback }: FileDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropCallback,
    accept: {
      "application/pdf": [".pdf"],
      "text/markdown": [".md"],
      "text/plain": [".txt"],
      "application/json": [".json"],
      "text/javascript": [".ts", ".tsx", ".js", ".jsx"],
      "text/x-python": [".py"],
      "text/x-sql": [".sql"],
    },
    maxSize: 10 * 1024 * 1024,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200",
        isDragActive
          ? "border-[--accent-primary] bg-[--accent-primary]/5 shadow-[inset_0_0_40px_var(--glow-soft)]"
          : "border-[--border-primary] hover:border-[--border-hover] bg-[--bg-tertiary]/20 hover:bg-[--bg-tertiary]/40"
      )}
    >
      <input {...getInputProps()} />
      <motion.div animate={isDragActive ? { y: -4 } : { y: 0 }} className="space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[--accent-primary] to-[--accent-hover] flex items-center justify-center mx-auto shadow-lg shadow-[--glow-soft]">
          <Upload className="w-7 h-7 text-black" />
        </div>
        <p className="font-bold text-[--text-primary] text-sm">
          {isDragActive ? "Release to upload" : "Drag & drop files here"}
        </p>
        <p className="text-xs text-[--text-muted]">or click to browse — PDF, MD, TXT, JSON, code files (max 10MB)</p>
      </motion.div>
    </div>
  );
}

export const LazyFileDropzone = memo(FileDropzoneInner);
