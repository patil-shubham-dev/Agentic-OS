import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { List, useListRef } from "react-window";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  AlertCircle,
  Search,
  Plus,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NormalizedModel } from "@/lib/runtime/types";

const ITEM_HEIGHT = 38;
const LIST_MAX_HEIGHT = 260;
const DEBOUNCE_MS = 200;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface ModelSelectorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModelId?: string;
  onSelect: (modelId: string) => void;
  models: NormalizedModel[];
  discoveryStatus: "idle" | "loading" | "success" | "error";
  discoveryError: string | null;
  providerId?: string;
  onTriggerDiscovery?: () => void;
}

export function ModelSelector({
  isOpen,
  onOpenChange,
  selectedModelId,
  onSelect,
  models,
  discoveryStatus,
  discoveryError,
  providerId,
  onTriggerDiscovery,
}: ModelSelectorProps) {
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedSearch = useDebounce(search, DEBOUNCE_MS);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useListRef(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return models;
    const q = debouncedSearch.toLowerCase();
    return models.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q)
    );
  }, [models, debouncedSearch]);

  const selectedModel = useMemo(
    () => (selectedModelId ? models.find((m) => m.id === selectedModelId) : null),
    [models, selectedModelId]
  );

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setActiveIndex(-1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      listRef.current.scrollToRow({ index: activeIndex, align: "smart" });
    }
  }, [activeIndex]);

  const handleSelect = useCallback(
    (modelId: string) => {
      onSelect(modelId);
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < filtered.length) {
            handleSelect(filtered[activeIndex].id);
          } else if (search && filtered.length === 0) {
            handleSelect(search);
          }
          break;
        case "Escape":
          e.preventDefault();
          onOpenChange(false);
          break;
        case "Home":
          e.preventDefault();
          setActiveIndex(0);
          break;
        case "End":
          e.preventDefault();
          setActiveIndex(filtered.length - 1);
          break;
      }
    },
    [filtered, activeIndex, handleSelect, search, onOpenChange]
  );

  const listHeight = Math.min(filtered.length * ITEM_HEIGHT, LIST_MAX_HEIGHT);

  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const m = filtered[index];
      const isSelected = m.id === selectedModelId;
      const isActive = index === activeIndex;
      return (
        <div
          style={style}
          className={cn(
            "flex items-center gap-2 px-3 text-xs cursor-pointer transition-colors",
            isActive || isSelected
              ? "bg-[--bg-elevated]"
              : "hover:bg-[--bg-elevated]/50"
          )}
          onClick={() => handleSelect(m.id)}
          onMouseEnter={() => setActiveIndex(index)}
          role="option"
          aria-selected={isSelected}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              m.speed === "fast"
                ? "bg-emerald-500"
                : m.speed === "balanced"
                  ? "bg-amber-500"
                  : "bg-[--text-disabled]"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[--text-primary] truncate leading-tight">
              {m.label}
            </div>
            <div className="text-[9px] text-[--text-muted] truncate font-mono leading-tight">
              {m.id}
            </div>
          </div>
          <div className="flex gap-1 shrink-0 items-center">
            {m.contextWindow >= 128000 && (
              <span className="px-1 py-0.5 rounded text-[8px] bg-blue-950/30 text-blue-400 border border-blue-800/30 leading-none">
                128K
              </span>
            )}
            {m.contextWindow >= 64000 && m.contextWindow < 128000 && (
              <span className="px-1 py-0.5 rounded text-[8px] bg-blue-950/30 text-blue-400 border border-blue-800/30 leading-none">
                64K
              </span>
            )}
            {m.capabilities.includes("vision") && (
              <span className="px-1 py-0.5 rounded text-[8px] bg-purple-950/30 text-purple-400 border border-purple-800/30 leading-none">
                Vision
              </span>
            )}
            {m.capabilities.includes("tools") && (
              <span className="px-1 py-0.5 rounded text-[8px] bg-amber-950/30 text-[--accent-soft] border border-[--border-secondary] leading-none">
                Tools
              </span>
            )}
            {m.capabilities.includes("fast-inference") && (
              <span className="px-1 py-0.5 rounded text-[8px] bg-emerald-950/30 text-emerald-400 border border-emerald-800/30 leading-none">
                Fast
              </span>
            )}
          </div>
        </div>
      );
    },
    [filtered, activeIndex, selectedModelId, handleSelect]
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="absolute z-50 mt-1 w-full min-w-[300px] rounded-xl border border-[--border-primary] bg-[--bg-primary] shadow-2xl overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[--border-primary]">
            <Search className="w-3.5 h-3.5 text-[--text-muted] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveIndex(0);
              }}
              placeholder="Search models..."
              className="flex-1 bg-transparent text-xs text-[--text-primary] placeholder:text-[--text-disabled] outline-none"
              role="combobox"
              aria-expanded="true"
              aria-haspopup="listbox"
              aria-label="Search models"
            />
          </div>

          <div
            className="overflow-y-auto"
            style={{ maxHeight: LIST_MAX_HEIGHT }}
          >
            {discoveryStatus === "loading" && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-[--accent-primary]" />
                <p className="text-xs text-[--text-muted]">Fetching available models...</p>
                <p className="text-[10px] text-[--text-disabled]">
                  Connecting to {providerId || "provider"}
                </p>
              </div>
            )}

            {discoveryStatus === "idle" && !search && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Search className="w-5 h-5 text-[--text-disabled]" />
                <p className="text-xs text-[--text-muted]">Enter API key to load models</p>
              </div>
            )}

            {discoveryStatus === "error" && (
              <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-xs font-medium text-red-400">Unable to fetch models</p>
                <p className="text-[10px] text-[--text-muted] break-words max-w-full">
                  {discoveryError || "Check the Base URL and API key, then try again."}
                </p>
                {onTriggerDiscovery && (
                  <button
                    onClick={onTriggerDiscovery}
                    className="mt-1 flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium bg-[--bg-elevated] border border-[--border-primary] text-[--text-secondary] hover:text-[--text-primary] transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry discovery
                  </button>
                )}
              </div>
            )}

            {discoveryStatus === "success" && (
              <>
                {filtered.length === 0 && search ? (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 text-xs text-[--text-muted] cursor-pointer rounded-lg hover:bg-[--bg-elevated] transition-colors m-1.5"
                    onClick={() => handleSelect(search)}
                  >
                    <Plus className="w-3 h-3" />
                    Use &ldquo;{search}&rdquo; as custom model
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-xs text-[--text-muted]">No models found</p>
                    <p className="text-[10px] text-[--text-disabled]">The endpoint returned zero models.</p>
                  </div>
                ) : (
                  <List
                    listRef={listRef}
                    rowCount={filtered.length}
                    rowHeight={ITEM_HEIGHT}
                    rowComponent={Row}
                    rowProps={{} as any}
                    overscanCount={8}
                    style={{ maxHeight: listHeight }}
                  />
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}