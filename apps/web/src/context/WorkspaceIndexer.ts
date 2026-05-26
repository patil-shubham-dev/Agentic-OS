import { ASTSummarizer, type ASTSummary } from "./ASTSummarizer"

export interface FileIndex {
  path: string
  summary: ASTSummary
  size: number
  lastModified: number
  extension: string
}

export interface IndexResult {
  files: FileIndex[]
  totalFiles: number
  indexedAt: number
  totalSize: number
}

export class WorkspaceIndexer {
  private index: Map<string, FileIndex> = new Map()
  private summarizer: ASTSummarizer

  constructor() {
    this.summarizer = new ASTSummarizer()
  }

  indexFile(path: string, source: string, lastModified?: number): FileIndex {
    const summary = this.summarizer.summarize(source)
    const file: FileIndex = {
      path,
      summary,
      size: source.length,
      lastModified: lastModified ?? Date.now(),
      extension: this.getExtension(path),
    }
    this.index.set(path, file)
    return file
  }

  indexFiles(files: { path: string; source: string; lastModified?: number }[]): IndexResult {
    let totalSize = 0
    for (const file of files) {
      const indexed = this.indexFile(file.path, file.source, file.lastModified)
      totalSize += indexed.size
    }

    return {
      files: Array.from(this.index.values()),
      totalFiles: this.index.size,
      indexedAt: Date.now(),
      totalSize,
    }
  }

  getFile(path: string): FileIndex | undefined {
    return this.index.get(path)
  }

  removeFile(path: string): boolean {
    return this.index.delete(path)
  }

  searchByExtension(extension: string): FileIndex[] {
    const result: FileIndex[] = []
    for (const file of this.index.values()) {
      if (file.extension === extension) {
        result.push(file)
      }
    }
    return result
  }

  searchByImport(importPath: string): FileIndex[] {
    const result: FileIndex[] = []
    for (const file of this.index.values()) {
      if (file.summary.imports.some((i) => i.includes(importPath))) {
        result.push(file)
      }
    }
    return result
  }

  searchByExport(exportName: string): FileIndex[] {
    const result: FileIndex[] = []
    for (const file of this.index.values()) {
      if (file.summary.exports.some((e) => e.includes(exportName))) {
        result.push(file)
      }
    }
    return result
  }

  searchByDependency(depName: string): FileIndex[] {
    const result: FileIndex[] = []
    for (const file of this.index.values()) {
      if (file.summary.dependencies.some((d) => d.includes(depName))) {
        result.push(file)
      }
    }
    return result
  }

  getAllFiles(): FileIndex[] {
    return Array.from(this.index.values())
  }

  clear(): void {
    this.index.clear()
  }

  getFileCount(): number {
    return this.index.size
  }

  private getExtension(path: string): string {
    const lastDot = path.lastIndexOf(".")
    return lastDot !== -1 ? path.slice(lastDot) : ""
  }
}
