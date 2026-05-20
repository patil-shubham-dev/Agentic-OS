"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDropzone } from "react-dropzone";
import { Label } from "@/components/ui/label";
import { getJson, sendJson } from "@/lib/client-api";
import { EmptyState } from "@/components/empty-state";

interface KnowledgeItem {
  id: string;
  name: string;
  type: "pdf" | "doc" | "code" | "url" | "image" | "text";
  size: string;
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

function mapKnowledgeItem(item: Record<string, unknown>): KnowledgeItem {
  return {
    id: String(item.id),
    name: String(item.name),
    type: (item.type as KnowledgeItem["type"]) ?? "text",
    size: Number(item.size ?? 0) > 0 ? `${item.size} bytes` : "—",
    chunks: Number(item.chunks ?? 0),
    status: (item.status as KnowledgeItem["status"]) ?? "indexed",
    uploadedAt: new Date(String(item.created_at)).toLocaleString(),
    source: String(item.source ?? "Upload"),
  };
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const itemVariant = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const response = await getJson<{ items: Array<Record<string, unknown>> }>("/api/knowledge");
    setItems(response.items.map(mapKnowledgeItem));
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    await sendJson("/api/knowledge", "POST", {
      name: file.name,
      type: "doc",
      source: "Upload",
      size: file.size,
      content: file.name,
      metadata: { summary: file.name },
    });

    await refresh();
    setUploadDialogOpen(false);
  }, [refresh]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/markdown": [".md"],
      "text/plain": [".txt"],
      "application/json": [".json"],
      "text/*": [".ts", ".tsx", ".js", ".jsx", ".py", ".sql"],
    },
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await getJson<{ results?: SearchResult[] }>(`/api/knowledge?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.results ?? []);
    } finally {
      setIsSearching(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "pdf": return <FileText className="w-4 h-4 text-red-500" />;
      case "doc": return <FileType className="w-4 h-4 text-blue-500" />;
      case "code": return <FileCode className="w-4 h-4 text-green-500" />;
      case "url": return <Globe className="w-4 h-4 text-primary" />;
      case "image": return <Image className="w-4 h-4 text-purple-500" />;
      default: return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">Upload documents, code, and URLs for semantic search and RAG</p>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Add Knowledge
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add to Knowledge Base</DialogTitle>
              <DialogDescription>Upload files or add URLs to index for semantic search</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upload">Upload Files</TabsTrigger>
                <TabsTrigger value="url">Add URL</TabsTrigger>
                <TabsTrigger value="code">Paste Code</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-4">
                <div
                  {...getRootProps()}
                  className={cn(
                    "cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-colors",
                    isDragActive ? "border-primary bg-primary/5" : "border-muted"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">{isDragActive ? "Drop files here" : "Drag & drop files here"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Supports PDF, MD, TXT, JSON, and code files</p>
                </div>
              </TabsContent>
              <TabsContent value="url" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input placeholder="https://docs.example.com" />
                </div>
                <Button className="w-full" disabled>Add URL</Button>
              </TabsContent>
              <TabsContent value="code" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="e.g., Authentication Logic" />
                </div>
                <Button className="w-full" disabled>Paste Code</Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search your knowledge base..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchResults.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Search Results</h3>
            <Button variant="ghost" size="sm" onClick={() => setSearchResults([])}>Clear</Button>
          </div>
          {searchResults.map((result) => (
            <Card key={result.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Quote className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">{result.content}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px]">{result.source}</Badge>
                      <span className="text-xs text-muted-foreground">Score: {(result.score * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Documents", value: String(items.length), icon: FileText },
          { label: "Total Chunks", value: String(items.reduce((sum, current) => sum + current.chunks, 0)), icon: Database },
          { label: "Indexed URLs", value: String(items.filter((current) => current.type === "url").length), icon: Globe },
          { label: "Storage Used", value: `${items.length} items`, icon: FolderOpen },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <stat.icon className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

        <h3 className="mb-3 font-semibold">Knowledge Items</h3>
        {loading && <p className="mb-3 text-sm text-muted-foreground">Loading knowledge base...</p>}
        {!loading && items.length === 0 ? (
          <EmptyState
            title="No documents indexed yet."
            description="Upload documents or configure a URL to index knowledge chunks for retrieval-augmented chat."
            icon={Database}
            action={
              <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setUploadDialogOpen(true)}>
                <Plus className="w-4 h-4" /> Add Knowledge
              </Button>
            }
          />
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
            {items.map((knowledgeItem) => (
              <motion.div key={knowledgeItem.id} variants={itemVariant}>
                <Card className="cursor-pointer transition-all hover:shadow-sm" onClick={() => setSelectedItem(knowledgeItem)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          {getIcon(knowledgeItem.type)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{knowledgeItem.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{knowledgeItem.size}</span>
                            {knowledgeItem.chunks > 0 && <span>{knowledgeItem.chunks} chunks</span>}
                            <span>{knowledgeItem.uploadedAt}</span>
                            <Badge variant="outline" className="text-[10px]">{knowledgeItem.source}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {knowledgeItem.status === "indexed" && (
                          <Badge className="gap-1 bg-green-500/10 text-green-500 hover:bg-green-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Indexed
                          </Badge>
                        )}
                        {knowledgeItem.status === "processing" && (
                          <Badge className="gap-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20">
                            <Loader2 className="h-3 w-3 animate-spin" /> Processing
                          </Badge>
                        )}
                        {knowledgeItem.status === "error" && (
                          <Badge className="gap-1 bg-destructive/10 text-destructive hover:bg-destructive/20">
                            <XCircle className="h-3 w-3" /> Error
                          </Badge>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          {selectedItem && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    {getIcon(selectedItem.type)}
                  </div>
                  <div>
                    <DialogTitle>{selectedItem.name}</DialogTitle>
                    <DialogDescription>
                      {selectedItem.chunks} chunks · {selectedItem.size} · Indexed {selectedItem.uploadedAt}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{selectedItem.type}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="font-medium">{selectedItem.source}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{selectedItem.status}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Chunks</p>
                    <p className="font-medium">{selectedItem.chunks}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p>This item is stored in Supabase and can now be surfaced to RAG, search, and workspace context flows.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="gap-2">
                  <Eye className="h-4 w-4" /> View Full
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
