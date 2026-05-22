"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FileText,
  Image,
  Search,
  Trash2,
  Database,
  Plus,
  FileCode,
  FileType,
  Globe,
  CheckCircle2,
  Loader2,
  Quote,
  Sparkles,
  BookOpen,
  Link2,
  Code2,
  AlertCircle,
  Clock,
  Layers,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getJson, sendJson } from "@/lib/client-api";
import { toast } from "sonner";

const FileUploadDropzone = dynamic(() => import("@/components/upload/FileDropzone").then((m) => ({ default: m.LazyFileDropzone })), { ssr: false });

interface KnowledgeItem {
  id: string;
  name: string;
  type: "pdf" | "doc" | "code" | "url" | "image" | "text";
  size: number;
  chunks: number;
  status: "indexed" | "processing" | "error";
  uploadedAt: string;
  source: string;
}

interface SearchResult {
  id: string;
  content: string;
  source: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface KnowledgeForm {
  name: string;
  content: string;
  type: string;
  source: string;
  tags: string;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  pdf: { icon: FileText, label: "PDF Document", color: "text-red-400", bg: "bg-red-950/30 border-red-800/50" },
  doc: { icon: FileType, label: "Document", color: "text-blue-400", bg: "bg-blue-950/30 border-blue-800/50" },
  code: { icon: FileCode, label: "Code", color: "text-emerald-400", bg: "bg-emerald-950/30 border-emerald-800/50" },
  url: { icon: Globe, label: "Web URL", color: "text-purple-400", bg: "bg-purple-950/30 border-purple-800/50" },
  image: { icon: Image, label: "Image", color: "text-rose-400", bg: "bg-rose-950/30 border-rose-800/50" },
  text: { icon: FileText, label: "Text", color: "text-[--accent-primary]", bg: "bg-[--accent-primary]/10 border-[--border-secondary]" },
};

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Items", icon: Layers },
  { value: "doc", label: "Documents", icon: FileText },
  { value: "code", label: "Code", icon: FileCode },
  { value: "url", label: "URLs", icon: Globe },
  { value: "image", label: "Images", icon: Image },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 200, damping: 22 } },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function mapKnowledgeItem(item: Record<string, unknown>): KnowledgeItem {
  let size = Number(item.size ?? 0);
  return {
    id: String(item.id),
    name: String(item.name),
    type: (item.type as KnowledgeItem["type"]) ?? "text",
    size: isNaN(size) ? 0 : size,
    chunks: Number(item.chunks ?? 0),
    status: (item.status as KnowledgeItem["status"]) ?? "indexed",
    uploadedAt: new Date(String(item.created_at)).toLocaleString(),
    source: String(item.source ?? "Upload"),
  };
}

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [uploadTab, setUploadTab] = useState("upload");
  const [form, setForm] = useState<KnowledgeForm>({ name: "", content: "", type: "doc", source: "Upload", tags: "" });
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await getJson<{ items: Array<Record<string, unknown>> }>("/api/knowledge");
      setItems(response.items.map(mapKnowledgeItem));
    } catch {
      toast.error("Failed to load knowledge base.");
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const handleUpload = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setSaving(true);
    try {
      const text = await file.text();
      await sendJson("/api/knowledge", "POST", {
        name: file.name,
        type: file.type.startsWith("image") ? "image" : file.name.endsWith(".pdf") ? "pdf" : file.name.endsWith(".md") ? "doc" : "text",
        source: "Upload",
        size: file.size,
        chunks: Math.ceil(text.length / 1000),
        content: text.substring(0, 5000),
        metadata: {
          summary: text.substring(0, 200),
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
        },
      });
      toast.success(`"${file.name}" uploaded and indexed.`);
      await refresh();
      setUploadDialogOpen(false);
    } catch {
      toast.error("Failed to upload file.");
    } finally {
      setSaving(false);
    }
  }, [refresh, form.tags]);

  const handleUploadFiles = useCallback((acceptedFiles: File[]) => {
    handleUpload(acceptedFiles);
  }, [handleUpload]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await getJson<{ results?: SearchResult[]; items?: Array<Record<string, unknown>> }>(
        `/api/knowledge?q=${encodeURIComponent(searchQuery)}`
      );
      setSearchResults(response.results ?? []);
      if (response.items) setItems(response.items.map(mapKnowledgeItem));
    } catch {
      toast.error("Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleDelete = async (item: KnowledgeItem) => {
    if (!confirm(`Remove "${item.name}" from the knowledge base?`)) return;
    try {
      await sendJson(`/api/knowledge`, "DELETE", { id: item.id });
      toast.success(`"${item.name}" removed.`);
      await refresh();
    } catch {
      toast.error("Failed to delete item.");
    }
  };

  const handleAddUrl = async () => {
    if (!form.name || !form.content) return;
    setSaving(true);
    try {
      await sendJson("/api/knowledge", "POST", {
        name: form.name,
        type: "url",
        source: form.content,
        size: form.content.length,
        chunks: Math.ceil(form.content.length / 1000),
        content: form.content,
        metadata: {
          summary: `URL: ${form.content}`,
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
        },
      });
      toast.success(`URL "${form.name}" indexed.`);
      setForm({ name: "", content: "", type: "doc", source: "Upload", tags: "" });
      setUploadDialogOpen(false);
      await refresh();
    } catch {
      toast.error("Failed to add URL.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCode = async () => {
    if (!form.name || !form.content) return;
    setSaving(true);
    try {
      await sendJson("/api/knowledge", "POST", {
        name: form.name,
        type: "code",
        source: "Pasted Code",
        size: form.content.length,
        chunks: Math.ceil(form.content.length / 1000),
        content: form.content,
        metadata: {
          summary: form.content.substring(0, 200),
          tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
        },
      });
      toast.success(`Code snippet "${form.name}" indexed.`);
      setForm({ name: "", content: "", type: "doc", source: "Upload", tags: "" });
      setUploadDialogOpen(false);
      await refresh();
    } catch {
      toast.error("Failed to add code.");
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = activeCategory === "all"
    ? items
    : items.filter((i) => i.type === activeCategory);

  const typeConfig = TYPE_CONFIG;
  const selectedConfig = selectedItem ? (typeConfig[selectedItem.type] || typeConfig.text) : null;

  const totalChunks = items.reduce((sum, i) => sum + i.chunks, 0);
  const totalUrls = items.filter((i) => i.type === "url").length;
  const totalSize = items.length > 0 ? formatBytes(items.reduce((sum, i) => sum + i.size, 0)) : "0 B";

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
                <span className="w-8 h-8 rounded-lg bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center relative">
                  <BookOpen className="w-4.5 h-4.5 text-[--accent-primary]" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[--accent-primary] rounded-full animate-ping opacity-40" />
                </span>
                Knowledge Base
              </h1>
              <p className="text-sm text-[--text-muted] mt-1 ml-11">
                Upload documents, code snippets, and URLs for semantic search and RAG retrieval.
              </p>
            </div>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="bg-[--accent-primary] text-black hover:bg-[--accent-hover] rounded-lg h-9 px-4 text-xs font-medium shadow-sm shadow-[--glow-soft]"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Knowledge
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg agentos-glass-elevated rounded-2xl p-0 overflow-hidden border-[--border-primary] max-h-[90vh] overflow-y-auto">
                <div className="px-6 pt-6 pb-4 border-b border-[--border-primary]">
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-[--accent-primary]" />
                      </span>
                      <div>
                        <DialogTitle className="text-lg font-semibold text-[--text-primary]">
                          Add Knowledge
                        </DialogTitle>
                        <DialogDescription className="text-xs text-[--text-muted] mt-0.5">
                          Import documents, URLs, or code snippets into your vector index.
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                </div>

                <div className="px-6 py-5">
                  <Tabs value={uploadTab} onValueChange={setUploadTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 p-0.5 bg-[--bg-secondary] border border-[--border-primary] rounded-xl">
                      <TabsTrigger value="upload" className="text-[11px] data-[state=active]:bg-[--bg-elevated] data-[state=active]:text-[--text-primary] rounded-lg text-[--text-muted]">
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Files
                      </TabsTrigger>
                      <TabsTrigger value="url" className="text-[11px] data-[state=active]:bg-[--bg-elevated] data-[state=active]:text-[--text-primary] rounded-lg text-[--text-muted]">
                        <Globe className="w-3.5 h-3.5 mr-1.5" /> URLs
                      </TabsTrigger>
                      <TabsTrigger value="code" className="text-[11px] data-[state=active]:bg-[--bg-elevated] data-[state=active]:text-[--text-primary] rounded-lg text-[--text-muted]">
                        <Code2 className="w-3.5 h-3.5 mr-1.5" /> Code
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="mt-4 space-y-4">
                      <FileUploadDropzone onDrop={handleUploadFiles} />
                      <div className="space-y-1.5">
                        <Label className="text-[--text-secondary] text-xs font-medium flex items-center gap-1">
                          <Info className="w-3 h-3 text-[--accent-primary]" /> Tags{" "}
                          <span className="text-[9px] text-[--text-muted] font-normal">(optional, comma-separated)</span>
                        </Label>
                        <Input
                          className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] rounded-lg h-9 text-xs agentos-focus-ring"
                          value={form.tags}
                          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                          placeholder="docs, api, reference"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="url" className="mt-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[--text-secondary] text-xs font-medium">Title / Label</Label>
                        <Input
                          className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] rounded-lg h-10 agentos-focus-ring"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="e.g., Supabase Docs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[--text-secondary] text-xs font-medium">URL</Label>
                        <div className="relative">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" />
                          <Input
                            className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] rounded-lg h-10 pl-9 agentos-focus-ring"
                            value={form.content}
                            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                            placeholder="https://docs.example.com/api"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[--text-secondary] text-xs font-medium flex items-center gap-1">
                          <Info className="w-3 h-3 text-[--accent-primary]" /> Tags
                        </Label>
                        <Input
                          className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] rounded-lg h-9 text-xs agentos-focus-ring"
                          value={form.tags}
                          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                          placeholder="docs, api, supabase"
                        />
                      </div>
                      <Button
                        onClick={handleAddUrl}
                        disabled={saving || !form.name || !form.content}
                        className="w-full bg-[--accent-primary] text-black hover:bg-[--accent-hover] rounded-lg h-10 font-medium shadow-sm shadow-[--glow-soft]"
                      >
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
                        Index URL
                      </Button>
                    </TabsContent>

                    <TabsContent value="code" className="mt-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[--text-secondary] text-xs font-medium">Snippet Name</Label>
                        <Input
                          className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] rounded-lg h-10 agentos-focus-ring"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="e.g., Auth Middleware"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[--text-secondary] text-xs font-medium">Code Content</Label>
                        <Textarea
                          className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] font-mono text-xs rounded-lg min-h-[140px] agentos-focus-ring"
                          value={form.content}
                          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                          placeholder="Paste your code here..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[--text-secondary] text-xs font-medium flex items-center gap-1">
                          <Info className="w-3 h-3 text-[--accent-primary]" /> Tags
                        </Label>
                        <Input
                          className="bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] rounded-lg h-9 text-xs agentos-focus-ring"
                          value={form.tags}
                          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                          placeholder="auth, middleware, nextjs"
                        />
                      </div>
                      <Button
                        onClick={handleAddCode}
                        disabled={saving || !form.name || !form.content}
                        className="w-full bg-[--accent-primary] text-black hover:bg-[--accent-hover] rounded-lg h-10 font-medium shadow-sm shadow-[--glow-soft]"
                      >
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Code2 className="w-4 h-4 mr-2" />}
                        Index Code
                      </Button>
                    </TabsContent>
                  </Tabs>
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>

          {/* Search Bar */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="agentos-card p-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-muted]" />
                  <Input
                    placeholder="Search your knowledge base..."
                    className="pl-9 bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] rounded-lg h-10 agentos-focus-ring"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!e.target.value) setSearchResults([]);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-[--accent-primary] text-black hover:bg-[--accent-hover] rounded-lg h-10 px-5 font-medium shadow-sm shadow-[--glow-soft]"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
                  Search
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Search Results */}
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                key="search-results"
                initial={{ opacity: 0, y: 16, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -16, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[--accent-primary]" />
                    Search Results ({searchResults.length})
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSearchResults([]); setSearchQuery(""); }}
                    className="h-8 text-xs text-[--text-muted] hover:bg-[--bg-elevated] rounded-lg"
                  >
                    Clear
                  </Button>
                </div>
                <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-2">
                  {searchResults.map((result) => (
                    <motion.div key={result.id} variants={itemVariants}>
                      <div className="agentos-card p-4 hover:border-[--border-hover] transition-all">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center shrink-0 mt-0.5">
                            <Quote className="w-4 h-4 text-[--accent-primary]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-relaxed text-[--text-primary] line-clamp-3">{result.content}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[9px] border-[--border-secondary] bg-[--accent-primary]/5 text-[--accent-soft] font-medium"
                              >
                                {result.source}
                              </Badge>
                              <span className="text-[10px] font-mono text-[--text-muted]">
                                Score: {(result.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0 shadow-[0_0_4px_var(--glow-soft)]",
                              result.score > 0.8
                                ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                                : result.score > 0.5
                                  ? "bg-[--accent-primary]"
                                  : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                            )}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-4 gap-4"
          >
            {[
              { label: "Documents", value: String(items.length), icon: FileText },
              { label: "Total Chunks", value: String(totalChunks), icon: Layers },
              { label: "Indexed URLs", value: String(totalUrls), icon: Globe },
              { label: "Storage Used", value: totalSize, icon: Database },
            ].map((stat) => (
              <div key={stat.label} className="agentos-card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-[--accent-primary]" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-[--text-primary]">{stat.value}</p>
                    <p className="text-[11px] text-[--text-muted] font-medium">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Category Filter Pills */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-2 flex-wrap"
          >
            {CATEGORY_OPTIONS.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setActiveCategory(cat.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all border",
                    isActive
                      ? "bg-[--bg-elevated] border-[--border-hover] text-[--text-primary] shadow-sm"
                      : "bg-[--bg-secondary] border-[--border-primary] text-[--text-muted] hover:bg-[--bg-elevated] hover:border-[--border-secondary]"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-[--accent-primary]" : "text-[--text-muted]")} />
                  {cat.label}
                  {cat.value !== "all" && (
                    <span
                      className={cn(
                        "ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-mono",
                        isActive ? "bg-[--accent-primary]/10 text-[--accent-primary]" : "bg-[--bg-tertiary] text-[--text-muted]"
                      )}
                    >
                      {items.filter((i) => i.type === cat.value).length}
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>

          {/* Knowledge Items List */}
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center py-20"
              >
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[--accent-primary]" />
                  <p className="text-sm text-[--text-muted]">Loading knowledge base...</p>
                </div>
              </motion.div>
            ) : filteredItems.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="py-16 text-center">
                  <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
                    <div className="w-16 h-16 rounded-2xl bg-[--accent-primary]/10 border border-[--border-secondary] flex items-center justify-center mx-auto mb-4">
                      <Database className="w-8 h-8 text-[--accent-primary]" />
                    </div>
                  </motion.div>
                  <h3 className="text-xl font-semibold text-[--text-primary]">
                    {activeCategory === "all" ? "No Documents Indexed Yet" : "No Items in This Category"}
                  </h3>
                  <p className="text-sm text-[--text-muted] max-w-md mx-auto mt-1 leading-relaxed">
                    {activeCategory === "all"
                      ? "Upload documents, index URLs, or paste code snippets into your knowledge base for retrieval-augmented generation."
                      : "Try a different category or upload new content."}
                  </p>
                  <Button
                    onClick={() => setUploadDialogOpen(true)}
                    className="mt-6 bg-[--accent-primary] text-black hover:bg-[--accent-hover] rounded-lg px-6 py-2.5 h-auto font-medium shadow-sm shadow-[--glow-soft]"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Your First Document
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`list-${activeCategory}`}
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-2"
              >
                {filteredItems.map((item) => {
                  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.text;
                  const Icon = config.icon;
                  return (
                    <motion.div key={item.id} variants={itemVariants} layout>
                      <div
                        className={cn(
                          "agentos-card p-4 transition-all duration-200 cursor-pointer",
                          "hover:border-[--border-hover]"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3 flex-1 min-w-0" onClick={() => setSelectedItem(item)}>
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                              config.bg
                            )}>
                              <Icon className={cn("w-5 h-5", config.color)} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[--text-primary] truncate">{item.name}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-[--text-muted]">{formatBytes(item.size)}</span>
                                {item.chunks > 0 && (
                                  <span className="text-[10px] text-[--text-muted] flex items-center gap-1">
                                    <Layers className="w-3 h-3" /> {item.chunks} chunk{item.chunks > 1 ? "s" : ""}
                                  </span>
                                )}
                                <Badge
                                  variant="outline"
                                  className="text-[9px] border-[--border-primary] bg-[--bg-tertiary] text-[--text-muted]"
                                >
                                  {item.source}
                                </Badge>
                                <span className="text-[9px] text-[--text-muted] flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {item.uploadedAt}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {item.status === "indexed" && (
                              <Badge className="gap-1 bg-emerald-900/40 border border-emerald-800/50 text-emerald-400 text-[10px] font-medium px-2.5 py-0.5 rounded-lg">
                                <CheckCircle2 className="w-3 h-3" /> Indexed
                              </Badge>
                            )}
                            {item.status === "processing" && (
                              <Badge className="gap-1 bg-blue-900/40 border border-blue-800/50 text-blue-400 text-[10px] font-medium px-2.5 py-0.5 rounded-lg">
                                <Loader2 className="w-3 h-3 animate-spin" /> Processing
                              </Badge>
                            )}
                            {item.status === "error" && (
                              <Badge className="gap-1 bg-red-900/40 border border-red-800/50 text-red-400 text-[10px] font-medium px-2.5 py-0.5 rounded-lg">
                                <AlertCircle className="w-3 h-3" /> Error
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item)}
                              className="h-8 w-8 text-rose-500 hover:bg-rose-950/30 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-xl agentos-glass-elevated rounded-2xl p-0 overflow-hidden border-[--border-primary]">
          {selectedItem && selectedConfig && (() => {
            const Icon = selectedConfig.icon;
            return (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-[--border-primary]">
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", selectedConfig.bg)}>
                        <Icon className={cn("w-6 h-6", selectedConfig.color)} />
                      </div>
                      <div className="min-w-0">
                        <DialogTitle className="text-lg font-semibold text-[--text-primary] truncate">
                          {selectedItem.name}
                        </DialogTitle>
                        <DialogDescription className="text-[11px] text-[--text-muted]">
                          {selectedConfig.label} · {formatBytes(selectedItem.size)} · {selectedItem.chunks} chunks
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                </div>

                <div className="px-6 py-5 space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-[--bg-tertiary]/40 border border-[--border-primary] space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[--text-muted]">Status</span>
                      <p className="text-sm font-semibold text-[--text-primary] flex items-center gap-1.5">
                        {selectedItem.status === "indexed" ? (
                          <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Indexed</>
                        ) : selectedItem.status === "processing" ? (
                          <><Loader2 className="w-4 h-4 text-blue-500 animate-spin" /> Processing</>
                        ) : (
                          <><AlertCircle className="w-4 h-4 text-red-500" /> Error</>
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[--bg-tertiary]/40 border border-[--border-primary] space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[--text-muted]">Source</span>
                      <p className="text-sm font-semibold text-[--text-primary] truncate">{selectedItem.source}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[--bg-tertiary]/40 border border-[--border-primary] space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[--text-muted]">Type</span>
                      <p className="text-sm font-semibold text-[--text-primary] capitalize">{selectedItem.type}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-[--bg-tertiary]/20 border border-[--border-primary] p-4 text-sm text-[--text-secondary] leading-relaxed">
                    <p className="flex items-center gap-2 text-xs font-semibold text-[--text-primary] mb-2">
                      <Info className="w-4 h-4 text-[--accent-primary]" /> About this item
                    </p>
                    <p className="text-[--text-muted]">
                      This knowledge item is stored in the vector index and can be surfaced to the workspace context, RAG pipeline, and semantic search queries during agent execution.
                    </p>
                  </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-[--border-primary] gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDelete(selectedItem)}
                    className="border-rose-800/50 text-rose-400 hover:bg-rose-950/30 rounded-lg h-10"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Remove
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
