import { create } from "zustand";
import type { ExecutionState, StreamingChunk } from "@/lib/runtime/types";

interface ExecutionStoreState {
  executions: Record<string, ExecutionState>;
  activeExecutionId: string | null;
  streamingLogs: Record<string, StreamingChunk[]>;
  executionGraph: Array<{
    taskId: string;
    role: string;
    modelId: string;
    providerId: string;
    status: string;
    runtime?: number;
    tokensUsed?: number;
  }>;

  startExecution: (taskId: string, role: string, modelId: string, providerId: string) => void;
  updateExecution: (taskId: string, updates: Partial<ExecutionState>) => void;
  appendLog: (taskId: string, chunk: StreamingChunk) => void;
  completeExecution: (taskId: string, summary?: string) => void;
  failExecution: (taskId: string, error: string) => void;
  setFallback: (taskId: string, fallbackChain: string[]) => void;
  clearExecution: (taskId: string) => void;
  clearAll: () => void;
  setActiveExecution: (id: string | null) => void;
}

export const useExecutionStore = create<ExecutionStoreState>()((set, get) => ({
  executions: {},
  activeExecutionId: null,
  streamingLogs: {},
  executionGraph: [],

  startExecution: (taskId, role, modelId, providerId) => {
    const execution: ExecutionState = {
      taskId,
      role,
      modelId,
      providerId,
      status: "running",
      tokensPerSecond: 0,
      runtime: 0,
      tokensUsed: 0,
      cost: 0,
    };

    set((state) => ({
      executions: { ...state.executions, [taskId]: execution },
      activeExecutionId: taskId,
      executionGraph: [
        { taskId, role, modelId, providerId, status: "running" },
        ...state.executionGraph,
      ],
    }));
  },

  updateExecution: (taskId, updates) => {
    set((state) => {
      const existing = state.executions[taskId];
      if (!existing) return state;
      return {
        executions: { ...state.executions, [taskId]: { ...existing, ...updates } },
        executionGraph: state.executionGraph.map((g) =>
          g.taskId === taskId ? { ...g, ...updates } : g
        ),
      };
    });
  },

  appendLog: (taskId, chunk) => {
    set((state) => ({
      streamingLogs: {
        ...state.streamingLogs,
        [taskId]: [...(state.streamingLogs[taskId] || []), chunk],
      },
    }));
  },

  completeExecution: (taskId, summary) => {
    set((state) => {
      const existing = state.executions[taskId];
      if (!existing) return state;
      return {
        executions: {
          ...state.executions,
          [taskId]: { ...existing, status: "completed", runtime: Date.now() - (existing.runtime ? Date.now() - existing.runtime : 0) },
        },
        executionGraph: state.executionGraph.map((g) =>
          g.taskId === taskId ? { ...g, status: "completed" } : g
        ),
        activeExecutionId: state.activeExecutionId === taskId ? null : state.activeExecutionId,
      };
    });
  },

  failExecution: (taskId, error) => {
    set((state) => {
      const existing = state.executions[taskId];
      if (!existing) return state;
      return {
        executions: {
          ...state.executions,
          [taskId]: { ...existing, status: "failed", error },
        },
        executionGraph: state.executionGraph.map((g) =>
          g.taskId === taskId ? { ...g, status: "failed" } : g
        ),
      };
    });
  },

  setFallback: (taskId, fallbackChain) => {
    set((state) => {
      const existing = state.executions[taskId];
      if (!existing) return state;
      return {
        executions: {
          ...state.executions,
          [taskId]: { ...existing, status: "fallback", fallbackChain },
        },
      };
    });
  },

  clearExecution: (taskId) => {
    set((state) => {
      const { [taskId]: _, ...rest } = state.executions;
      const { [taskId]: __, ...logs } = state.streamingLogs;
      return {
        executions: rest,
        streamingLogs: logs,
        executionGraph: state.executionGraph.filter((g) => g.taskId !== taskId),
        activeExecutionId: state.activeExecutionId === taskId ? null : state.activeExecutionId,
      };
    });
  },

  clearAll: () => set({ executions: {}, streamingLogs: {}, executionGraph: [], activeExecutionId: null }),

  setActiveExecution: (id) => set({ activeExecutionId: id }),
}));
