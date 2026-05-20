"use client";

import { memo, Suspense, lazy, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface FlowBuilderProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  className?: string;
}

function FlowBuilderInner({ initialNodes, initialEdges, className }: FlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
      className={className}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}

function FlowFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-amber-50/20">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <span className="text-xs text-amber-600/70">Loading workflow builder...</span>
      </div>
    </div>
  );
}

export const LazyFlowBuilder = memo(function LazyFlowBuilder(props: FlowBuilderProps) {
  return (
    <Suspense fallback={<FlowFallback />}>
      <FlowBuilderInner {...props} />
    </Suspense>
  );
});
