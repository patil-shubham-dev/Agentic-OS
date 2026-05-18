"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload,
  FileText,
  Link,
  Code,
  Image,
  Search,
  Trash2,
  Download,
  Eye,
  Database,
  Brain,
  Zap,
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
  metadata: Record<string, any>;
}

const knowledgeItems: KnowledgeItem[] = [
  { id: "1", name: "API Documentation.pdf", type: "pdf", size: "2.4 MB", chunks: 156, status: "indexed", uploadedAt: "2 days ago", source: "Upload" },
  { id: "2", name: "React Best Practices.md", type: "code", size: "45 KB", chunks: 23, status: "indexed", uploadedAt: "1 week ago", source: "Upload" },
  { id: "3", name: "Design System v2.fig", type: "image", size: "12.8 MB", chunks: 0, status: "processing", uploadedAt: "3 hrs ago", source: "Upload" },
  { id: "4", name: "https://docs.agentos.dev", type: "url", size: "—", chunks: 89, status: "indexed", uploadedAt: "5 days ago", source: "URL" },
  { id: "5", name: "Database Schema.sql", type: "code", size: "128 KB", chunks: 34, status: "indexed", uploadedAt: "2 weeks ago", source: "Upload" },
  { id: "6", name: "Product Requirements.pdf", type: "pdf", size: "5.1 MB", chunks: 312, status: "indexed", uploadedAt: "1 day ago", source: "Upload" },
  { id: "7", name: "https://github.com/nexu-io/open-design", type: "url", size: "—", chunks: 245, status: "indexed", uploadedAt: "1 week ago", source: "GitHub" },
];

const mockSearchResults: SearchResult[] = [
  {
    id: "1",
    content: "The AgentOS API uses RESTful conventions with JSON payloads. Authentication is handled via Bearer tokens...",
    source: "API Documentation.pdf",
    score: 0.94,
    metadata: { page: 12, section: "Authentication" },
  },
  {
    id: "2",
    content: "All endpoints return standard HTTP status codes. 200 for success, 400 for bad requests, 401 for unauthorized...",
    source: "API Documentation.pdf",
    score: 0.87,
    metadata: { page: 15, section: "Error Handling" },
  },
  {
    id: "3",
    content: "Rate limiting is applied at 1000 requests per minute for Pro plans and 100 requests per minute for Free plans...",
    source: "API Documentation.pdf",
    score: 0.82,
    metadata: { page: 18, section: "Rate Limits" },
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log("Uploading files:", acceptedFiles);
    setUploadDialogOpen(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/markdown': ['.md'],
      'text/plain': ['.txt'],
      'application/json': ['.json'],
      'text/*': ['.ts', '.tsx', '.js', '.jsx', '.py', '.sql'],
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setTimeout(() => {
      setSearchResults(mockSearchResults);
      setIsSearching(false);
    }, 800);
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
      {/* Header */}
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
                    "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
                    isDragActive ? "border-primary bg-primary/5" : "border-muted"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                  <p className="font-medium">
                    {isDragActive ? "Drop files here" : "Drag & drop files here"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or click to browse. Supports PDF, MD, TXT, JSON, code files
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="url" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input placeholder="https://docs.example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Crawl Depth</Label>
                  <Input type="number" defaultValue={1} min={0} max={3} />
                </div>
                <Button className="w-full">Add URL</Button>
              </TabsContent>
              <TabsContent value="code" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="e.g., Authentication Logic" />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <textarea className="w-full h-40 p-3 rounded-md border bg-background text-sm font-mono resize-none" placeholder="Paste your code here..." />
                </div>
                <Button className="w-full">Add Code</Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search your knowledge base..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Search Results</h3>
            <Button variant="ghost" size="sm" onClick={() => setSearchResults([])}>
              Clear
            </Button>
          </div>
          {searchResults.map((result) => (
            <Card key={result.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Quote className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed">{result.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="outline" className="text-[10px]">
                        <FileText className="w-3 h-3 mr-1" /> {result.source}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Score: {(result.score * 100).toFixed(1)}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Page {result.metadata.page}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Documents", value: "24", icon: FileText },
          { label: "Total Chunks", value: "12.4K", icon: Database },
          { label: "Indexed URLs", value: "8", icon: Globe },
          { label: "Storage Used", value: "156 MB", icon: FolderOpen },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Knowledge Items */}
      <div>
        <h3 className="font-semibold mb-3">Knowledge Items</h3>
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
          {knowledgeItems.map((item) => (
            <motion.div key={item.id} variants={item}>
              <Card
                className="cursor-pointer hover:shadow-sm transition-all"
                onClick={() => setSelectedItem(item)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        {getIcon(item.type)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{item.size}</span>
                          {item.chunks > 0 && <span>{item.chunks} chunks</span>}
                          <span>{item.uploadedAt}</span>
                          <Badge variant="outline" className="text-[10px]">{item.source}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === "indexed" && (
                        <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Indexed
                        </Badge>
                      )}
                      {item.status === "processing" && (
                        <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Processing
                        </Badge>
                      )}
                      {item.status === "error" && (
                        <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/20 gap-1">
                          <XCircle className="w-3 h-3" /> Error
                        </Badge>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl">
          {selectedItem && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
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
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{selectedItem.type}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="font-medium">{selectedItem.source}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{selectedItem.status}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Chunks</p>
                    <p className="font-medium">{selectedItem.chunks}</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Preview</h4>
                  <div className="p-4 rounded-lg bg-muted/30 text-sm text-muted-foreground max-h-60 overflow-auto">
                    <p>Document content preview would appear here...</p>
                    <p className="mt-2">This is a placeholder for the actual document content viewer with syntax highlighting for code, PDF rendering, or web page preview depending on the document type.</p>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="gap-2">
                  <Eye className="w-4 h-4" /> View Full
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" /> Download
                </Button>
                <Button variant="outline" className="gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" /> Remove
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
