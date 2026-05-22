"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, Clock, Globe, HardDrive, Loader2, AlertCircle, Layers, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getJson } from "@/lib/client-api";

interface MemoryRow {
  id: string;
  scope: "project" | "global";
  key: string;
  value: string;
  updated_at: string;
}

interface MemoryResponse {
  memories: MemoryRow[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 22 } },
};

export default function MemoryPage() {
  const { data, isLoading, isError } = useQuery<MemoryResponse>({
    queryKey: ["memories"],
    queryFn: () => getJson<MemoryResponse>("/api/memory"),
  });

  const memories = data?.memories ?? [];

  return (
    <div className="h-full overflow-hidden flex flex-col agentos-shell">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-6 space-y-6 max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-2xl font-bold text-[--text-primary] flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center">
                  <BrainCircuit className="w-4.5 h-4.5 text-[--accent-primary]" />
                </span>
                Memory
              </h1>
              <p className="text-sm text-[--text-muted] mt-1 ml-11">
                Long-term context that agents can read and write across runs.
              </p>
            </div>

            {memories.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[--text-muted]">
                  {memories.length} entr{memories.length === 1 ? "y" : "ies"}
                </span>
                <Badge className="bg-[--bg-elevated] border border-[--border-primary] text-[--text-muted] text-[10px] font-medium rounded-lg">
                  <Layers className="w-3 h-3 mr-1" />
                  {memories.filter((m) => m.scope === "global").length} global ·{" "}
                  {memories.filter((m) => m.scope === "project").length} project
                </Badge>
              </div>
            )}
          </motion.div>

          {/* Error state */}
          <AnimatePresence>
            {isError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-950/30 border border-red-800/50"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm font-medium text-red-300">Failed to load memories.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-20"
            >
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[--accent-primary]" />
                <p className="text-sm text-[--text-muted]">Loading memories...</p>
              </div>
            </motion.div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && memories.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-20 text-center"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              >
                <div className="w-16 h-16 rounded-2xl bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center mx-auto mb-4">
                  <HardDrive className="w-8 h-8 text-[--accent-primary]" />
                </div>
              </motion.div>
              <h3 className="text-xl font-semibold text-[--text-primary]">No Memories Stored</h3>
              <p className="text-sm text-[--text-muted] max-w-md mx-auto mt-1 leading-relaxed">
                Agents will populate this list as they save context, preferences, and learnings across sessions.
              </p>
            </motion.div>
          )}

          {/* Memory Grid */}
          {!isLoading && memories.length > 0 && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {memories.map((memory: MemoryRow, idx: number) => (
                  <motion.div
                    key={memory.id}
                    variants={itemVariants}
                    layout
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="agentos-card p-4 flex flex-col gap-2 group hover:border-[--border-hover] transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[--text-primary] truncate flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-[--accent-primary] shrink-0" />
                        {memory.key}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] capitalize border px-1.5 py-0 font-medium shrink-0",
                          memory.scope === "global"
                            ? "bg-purple-950/30 text-purple-400 border-purple-800/50"
                            : "bg-emerald-950/30 text-emerald-400 border-emerald-800/50"
                        )}
                      >
                        {memory.scope === "global" ? <Globe className="w-2.5 h-2.5 mr-1" /> : <HardDrive className="w-2.5 h-2.5 mr-1" />}
                        {memory.scope}
                      </Badge>
                    </div>
                    <p className="text-xs text-[--text-secondary] line-clamp-4 whitespace-pre-wrap leading-relaxed">
                      {memory.value}
                    </p>
                    <div className="mt-auto pt-2 border-t border-[--border-primary] flex items-center justify-between">
                      <span className="text-[10px] text-[--text-muted] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Updated {new Date(memory.updated_at).toLocaleString()}
                      </span>
                      <span className="text-[9px] text-[--text-disabled] font-mono">
                        #{idx + 1}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
