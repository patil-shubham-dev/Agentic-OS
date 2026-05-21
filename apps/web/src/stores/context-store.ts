import { create } from "zustand";
import { contextIndexer } from "@/lib/runtime/context-indexer";

interface ContextStoreState {
  indexBuilt: boolean;
  indexing: boolean;
  indexedFiles: number;
  lastBuildTime: string | null;
  build: (rootPath: string) => Promise<void>;
  reset: () => void;
}

export const useContextStore = create<ContextStoreState>((set) => ({
  indexBuilt: false,
  indexing: false,
  indexedFiles: 0,
  lastBuildTime: null,

  build: async (rootPath: string) => {
    set({ indexing: true });
    const before = Date.now();
    await contextIndexer.build(rootPath);
    set({
      indexBuilt: contextIndexer.isBuilt(),
      indexing: false,
      indexedFiles: contextIndexer["index"].size,
      lastBuildTime: new Date().toISOString(),
    });
  },

  reset: () => {
    contextIndexer.reset();
    set({ indexBuilt: false, indexing: false, indexedFiles: 0, lastBuildTime: null });
  },
}));
