"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Eye,
  Database,
  Plus,
  FolderOpen,
  FileCode,
  FileType,
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  Quote,
  Sparkles,
  BookOpen,
  Link2,
  Code2,
  AlertCircle,
  Clock,
  Wifi,
  Layers,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDropzone } from "react-dropzone";
import { getJson, sendJson } from "@/lib/client-api";
import { toast } from "sonner";

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
  pdf: { icon: FileText, label: "PDF Document", color: "text-red-600", bg: "bg-red-50 border-red-200/60" },
  doc: { icon: FileType, label: "Document", color: "text-blue-600", bg: "bg-blue-50 border-blue-200/60" },
  code: { icon: FileCode, label: "Code", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200/60" },
  url: { icon: Globe, label: "Web URL", color: "text-purple-600", bg: "bg-purple-50 border-purple-200/60" },
  image: { icon: Image, label: "Image", color: "text-rose-600", bg: "bg-rose-50 border-rose-200/60" },
  text: { icon: FileText, label: "Text", color: "text-amber-600", bg: "bg-amber-50 border-amber-200/60" },
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleUpload,
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

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-amber-950 flex items-center gap-3">
            <span className="relative">
              <BookOpen className="w-8 h-8 text-amber-600" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping opacity-40" />
            </span>
            Knowledge Base
          </h1>
          <p className="text-sm text-amber-700/80 mt-1 ml-11">Upload documents, code snippets, and URLs for semantic search and RAG retrieval.</p>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-md rounded-xl px-5 py-2.5 h-auto">
                <Plus className="w-4 h-4 mr-2" /> Add Knowledge
              </Button>
            </motion.div>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-white border border-amber-200 rounded-3xl shadow-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent px-6 pt-6 pb-4 border-b border-amber-100">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 border border-amber-200">
                    <Sparkles className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold text-amber-950">Add Knowledge</DialogTitle>
                    <DialogDescription className="text-xs text-amber-600/70 mt-0.5">
                      Import documents, URLs, or code snippets into your vector index.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="px-6 py-5">
              <Tabs value={uploadTab} onValueChange={setUploadTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 p-1 bg-amber-100/50 rounded-xl border border-amber-200/50">
                  <TabsTrigger value="upload" className="text-[11px] data-[state=active]:bg-white data-[state=active]:text-amber-900 rounded-lg">
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Files
                  </TabsTrigger>
                  <TabsTrigger value="url" className="text-[11px] data-[state=active]:bg-white data-[state=active]:text-amber-900 rounded-lg">
                    <Globe className="w-3.5 h-3.5 mr-1.5" /> URLs
                  </TabsTrigger>
                  <TabsTrigger value="code" className="text-[11px] data-[state=active]:bg-white data-[state=active]:text-amber-900 rounded-lg">
                    <Code2 className="w-3.5 h-3.5 mr-1.5" /> Code
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-4 space-y-4">
                  <div
                    {...getRootProps()}
                    className={cn(
                      "cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200",
                      isDragActive
                        ? "border-amber-400 bg-amber-50/60 shadow-inner"
                        : "border-amber-200/70 hover:border-amber-300 bg-amber-50/20 hover:bg-amber-50/40"
                    )}
                  >
                    <input {...getInputProps()} />
                    <motion.div animate={isDragActive ? { y: -4 } : { y: 0 }} className="space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-200/50">
                        <Upload className="w-7 h-7 text-white" />
                      </div>
                      <p className="font-bold text-amber-950 text-sm">
                        {isDragActive ? "Release to upload" : "Drag & drop files here"}
                      </p>
                      <p className="text-xs text-amber-600/70">or click to browse — PDF, MD, TXT, JSON, code files (max 10MB)</p>
                    </motion.div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-amber-950 text-xs font-bold flex items-center gap-1">
                      <Info className="w-3 h-3 text-amber-500" /> Tags <span className="text-[9px] text-amber-500 font-normal">(optional, comma-separated)</span>
                    </Label>
                    <Input
                      className="border-amber-200 text-amber-950 rounded-xl h-9 text-xs"
                      value={form.tags}
                      onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                      placeholder="docs, api, reference"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="url" className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-amber-950 text-xs font-bold">Title / Label</Label>
                    <Input
                      className="border-amber-200 text-amber-950 rounded-xl h-10"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g., Supabase Docs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-amber-950 text-xs font-bold">URL</Label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                      <Input
                        className="border-amber-200 text-amber-950 rounded-xl h-10 pl-9"
                        value={form.content}
                        onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                        placeholder="https://docs.example.com/api"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-amber-950 text-xs font-bold flex items-center gap-1">
                      <Info className="w-3 h-3 text-amber-500" /> Tags
                    </Label>
                    <Input
                      className="border-amber-200 text-amber-950 rounded-xl h-9 text-xs"
                      value={form.tags}
                      onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                      placeholder="docs, api, supabase"
                    />
                  </div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={handleAddUrl}
                      disabled={saving || !form.name || !form.content}
                      className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl shadow-sm h-10"
                    >
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
                      Index URL
                    </Button>
                  </motion.div>
                </TabsContent>

                <TabsContent value="code" className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-amber-950 text-xs font-bold">Snippet Name</Label>
                    <Input
                      className="border-amber-200 text-amber-950 rounded-xl h-10"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g., Auth Middleware"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-amber-950 text-xs font-bold">Code Content</Label>
                    <Textarea
                      className="border-amber-200 font-mono text-xs rounded-xl bg-white min-h-[140px]"
                      value={form.content}
                      onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                      placeholder="Paste your code here..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-amber-950 text-xs font-bold flex items-center gap-1">
                      <Info className="w-3 h-3 text-amber-500" /> Tags
                    </Label>
                    <Input
                      className="border-amber-200 text-amber-950 rounded-xl h-9 text-xs"
                      value={form.tags}
                      onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                      placeholder="auth, middleware, nextjs"
                    />
                  </div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={handleAddCode}
                      disabled={saving || !form.name || !form.content}
                      className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl shadow-sm h-10"
                    >
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Code2 className="w-4 h-4 mr-2" />}
                      Index Code
                    </Button>
                  </motion.div>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Search Bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border border-amber-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
                <Input
                  placeholder="Search your knowledge base..."
                  className="pl-9 border-amber-200 text-amber-950 rounded-xl h-10 bg-amber-50/20"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value) setSearchResults([]);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl h-10 px-5 shadow-sm"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
                  Search
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
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
              <h3 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Search Results ({searchResults.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={() => { setSearchResults([]); setSearchQuery(""); }}
                className="h-8 text-xs text-amber-700 hover:bg-amber-50 rounded-lg">
                Clear
              </Button>
            </div>
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-2">
              {searchResults.map((result) => (
                <motion.div key={result.id} variants={itemVariants}>
                  <Card className="border border-amber-200/50 hover:border-amber-300/70 hover:shadow-sm transition-all rounded-xl bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Quote className="w-4 h-4 text-amber-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed text-amber-950 line-clamp-3">{result.content}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[9px] border-amber-200 bg-amber-50/50 text-amber-800 font-medium">
                              {result.source}
                            </Badge>
                            <span className="text-[10px] font-mono text-amber-600/70">
                              Score: {(result.score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            result.score > 0.8 ? "bg-emerald-500" : result.score > 0.5 ? "bg-amber-500" : "bg-red-500"
                          )} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-4 gap-4"
      >
        {[
          { label: "Documents", value: String(items.length), icon: FileText, color: "from-amber-400 to-amber-600" },
          { label: "Total Chunks", value: String(items.reduce((sum, i) => sum + i.chunks, 0)), icon: Layers, color: "from-blue-400 to-blue-600" },
          { label: "Indexed URLs", value: String(items.filter((i) => i.type === "url").length), icon: Globe, color: "from-purple-400 to-purple-600" },
          { label: "Storage Used", value: items.length > 0 ? formatBytes(items.reduce((sum, i) => sum + i.size, 0)) : "0 B", icon: Database, color: "from-emerald-400 to-emerald-600" },
        ].map((stat) => (
          <Card key={stat.label} className="border border-amber-200/60 shadow-sm rounded-2xl bg-white overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm", stat.color)}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-amber-950">{stat.value}</p>
                  <p className="text-[11px] text-amber-600/70 font-medium">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Category Filter Pills */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
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
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border",
                isActive
                  ? "bg-amber-100 border-amber-200 text-amber-900 shadow-sm"
                  : "bg-white border-amber-200/60 text-amber-700 hover:bg-amber-50/60 hover:border-amber-300"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", isActive ? "text-amber-600" : "text-amber-500")} />
              {cat.label}
              {cat.value !== "all" && (
                <Badge className={cn(
                  "ml-1 text-[9px] px-1.5 py-0 rounded-full font-mono border-none",
                  isActive ? "bg-amber-200/70 text-amber-900" : "bg-amber-100/70 text-amber-700"
                )}>
                  {items.filter((i) => i.type === cat.value).length}
                </Badge>
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Knowledge Items List */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
              <p className="text-sm text-amber-700/70">Loading knowledge base...</p>
            </div>
          </motion.div>
        ) : filteredItems.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card className="border-none shadow-sm bg-gradient-to-br from-amber-50/30 to-amber-100/20 py-16 text-center rounded-3xl">
              <CardContent className="space-y-4">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-amber-200/50">
                    <Database className="w-8 h-8 text-white" />
                  </div>
                </motion.div>
                <h3 className="text-xl font-bold text-amber-950">
                  {activeCategory === "all" ? "No Documents Indexed Yet" : "No Items in This Category"}
                </h3>
                <p className="text-sm text-amber-700/70 max-w-md mx-auto leading-relaxed">
                  {activeCategory === "all"
                    ? "Upload documents, index URLs, or paste code snippets into your knowledge base for retrieval-augmented generation."
                    : "Try a different category or upload new content."}
                </p>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button onClick={() => setUploadDialogOpen(true)}
                    className="mt-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-lg shadow-amber-200/50 px-6 py-2.5 h-auto">
                    <Plus className="w-4 h-4 mr-2" /> Add Your First Document
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
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
                  <Card className={cn(
                    "border shadow-sm rounded-xl bg-white transition-all duration-200 cursor-pointer",
                    "hover:shadow-md hover:border-amber-300/70"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0" onClick={() => setSelectedItem(item)}>
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                            config.bg
                          )}>
                            <Icon className={cn("w-5 h-5", config.color)} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-amber-950 truncate">{item.name}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono text-amber-600/70">{formatBytes(item.size)}</span>
                              {item.chunks > 0 && (
                                <span className="text-[10px] text-amber-600/70 flex items-center gap-1">
                                  <Layers className="w-3 h-3" /> {item.chunks} chunk{item.chunks > 1 ? "s" : ""}
                                </span>
                              )}
                              <Badge variant="outline" className="text-[9px] border-amber-200 bg-amber-50/50 text-amber-700">
                                {item.source}
                              </Badge>
                              <span className="text-[9px] text-amber-500/70 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {item.uploadedAt}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === "indexed" && (
                            <Badge className="gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-[10px] font-semibold px-2.5 py-0.5 rounded-lg">
                              <CheckCircle2 className="w-3 h-3" /> Indexed
                            </Badge>
                          )}
                          {item.status === "processing" && (
                            <Badge className="gap-1 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-[10px] font-semibold px-2.5 py-0.5 rounded-lg">
                              <Loader2 className="w-3 h-3 animate-spin" /> Processing
                            </Badge>
                          )}
                          {item.status === "error" && (
                            <Badge className="gap-1 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-[10px] font-semibold px-2.5 py-0.5 rounded-lg">
                              <AlertCircle className="w-3 h-3" /> Error
                            </Badge>
                          )}
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item)}
                              className="h-8 w-8 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-xl bg-white border border-amber-200 rounded-3xl shadow-2xl p-0 overflow-hidden">
          {selectedItem && selectedConfig && (() => {
            const Icon = selectedConfig.icon;
            return (
              <>
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent px-6 pt-6 pb-4 border-b border-amber-100">
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border", selectedConfig.bg)}>
                        <Icon className={cn("w-6 h-6", selectedConfig.color)} />
                      </div>
                      <div className="min-w-0">
                        <DialogTitle className="text-lg font-bold text-amber-950 truncate">{selectedItem.name}</DialogTitle>
                        <DialogDescription className="text-[11px] text-amber-600/70">
                          {selectedConfig.label} · {formatBytes(selectedItem.size)} · {selectedItem.chunks} chunks
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                </div>

                <div className="px-6 py-5 space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-100/60 space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/70">Status</span>
                      <p className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                        {selectedItem.status === "indexed" ? (
                          <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Indexed</>
                        ) : selectedItem.status === "processing" ? (
                          <><Loader2 className="w-4 h-4 text-blue-500 animate-spin" /> Processing</>
                        ) : (
                          <><XCircle className="w-4 h-4 text-red-500" /> Error</>
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-100/60 space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/70">Source</span>
                      <p className="text-sm font-bold text-amber-950 truncate">{selectedItem.source}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-100/60 space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/70">Type</span>
                      <p className="text-sm font-bold text-amber-950 capitalize">{selectedItem.type}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-amber-50/20 border border-amber-100/50 p-4 text-sm text-amber-700/80 leading-relaxed">
                    <p className="flex items-center gap-2 text-xs font-semibold text-amber-900 mb-2">
                      <Info className="w-4 h-4 text-amber-500" /> About this item
                    </p>
                    <p>This knowledge item is stored in the vector index and can be surfaced to the workspace context, RAG pipeline, and semantic search queries during agent execution.</p>
                  </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-amber-100 bg-amber-50/20 gap-2">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="outline"
                      onClick={() => handleDelete(selectedItem)}
                      className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl h-10 px-5"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Remove
                    </Button>
                  </motion.div>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
