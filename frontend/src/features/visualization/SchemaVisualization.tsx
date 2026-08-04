import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Edge,
} from "@xyflow/react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useMetadata } from "@/hooks/useDatabase";
import { useUIStore } from "@/store/useUIStore";
import { useSettingsStore, type ConnectorStyle } from "@/store/useSettingsStore";
import { TableNode } from "./TableNode";
import { VisualizationToolbar } from "./VisualizationToolbar";
import { autoLayout } from "./autoLayout";
import {
  allTables,
  buildSchemaEdges,
  buildSchemaNodes,
  tableMap,
} from "./buildGraph";
import type { TableNode as TableNodeType } from "./types";

const nodeTypes = { tableNode: TableNode };

const CONNECTOR_MAP: Record<ConnectorStyle, "default" | "straight" | "step"> = {
  bezier: "default",
  straight: "straight",
  step: "step",
};

/** Full-schema React Flow canvas. */
export function SchemaVisualization() {
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);
  const metadataQuery = useMetadata(activeDbPath);
  const metadata = metadataQuery.data;

  const highlightTable = useUIStore((s) => s.highlightTable);
  const setHighlightTable = useUIStore((s) => s.setHighlightTable);
  const selectedTableName = useUIStore((s) => s.selectedTableName);
  const setSelectedTable = useUIStore((s) => s.setSelectedTable);

  const connectorStyle = useSettingsStore((s) => s.connectorStyle);
  const showMinimap = useSettingsStore((s) => s.showMinimap);
  const showColumns = useSettingsStore((s) => s.showColumns);
  const animationSpeed = useSettingsStore((s) => s.animationSpeed);

  const [nodes, setNodes, onNodesChange] = useNodesState<TableNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [search, setSearch] = useState("");
  const [highlightRels, setHighlightRels] = useState(false);
  const rfInstance = useReactFlow();
  const layoutAppliedRef = useRef<Set<string>>(new Set());
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  const tables = useMemo(() => (metadata ? allTables(metadata) : []), [metadata]);
  const tablesMap = useMemo(() => tableMap(tables), [tables]);

  // Resolve search -> first matching table name, store into highlightTable.
  useEffect(() => {
    if (!search.trim()) {
      setHighlightTable(null);
      return;
    }
    const q = search.trim().toLowerCase();
    const match = tables.find((t) => t.name.toLowerCase().includes(q));
    setHighlightTable(match ? match.name : null);
  }, [search, tables, setHighlightTable]);

  // Effective highlight: search highlight wins; otherwise (when relationships toggle
  // is on) the selected table is used as the highlight.
  const effectiveHighlight =
    highlightTable ?? (highlightRels && selectedTableName ? selectedTableName : null);

  // Rebuild nodes when metadata / settings change, preserving dragged positions.
  useEffect(() => {
    const existing = positionsRef.current;
    const newNodes = buildSchemaNodes(tables, {
      showColumns,
      highlight: effectiveHighlight,
      existingPositions: existing,
    });
    setNodes(newNodes);

    // Apply auto-layout only for nodes we have never laid out.
    const needLayout = newNodes.filter((n) => !existing.has(n.id));
    if (needLayout.length > 0) {
      const positioned = autoLayout(newNodes, buildSchemaEdges(tables, {
        highlight: effectiveHighlight,
        connectorType: CONNECTOR_MAP[connectorStyle],
        animationSpeed,
      }), {
        hasColumns: (id) => {
          const t = tablesMap.get(id);
          return !!t && t.columns.length > 0;
        },
        columnCount: (id) => tablesMap.get(id)?.columns.length ?? 0,
        showColumns,
      });
      positioned.forEach((n) => {
        existing.set(n.id, n.position);
        layoutAppliedRef.current.add(n.id);
      });
      setNodes(positioned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, showColumns, effectiveHighlight]);

  // Rebuild edges when relevant inputs change.
  useEffect(() => {
    setEdges(
      buildSchemaEdges(tables, {
        highlight: effectiveHighlight,
        connectorType: CONNECTOR_MAP[connectorStyle],
        animationSpeed,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, connectorStyle, animationSpeed, effectiveHighlight]);

  // Track positions as the user drags nodes.
  const onNodeDragStop = useCallback(() => {
    // read current node positions from store via the React Flow instance
    const all = rfInstance.getNodes();
    for (const n of all) {
      positionsRef.current.set(n.id, { x: n.position.x, y: n.position.y });
    }
  }, [rfInstance]);

  const handleAutoLayout = useCallback(() => {
    const positioned = autoLayout(nodes, edges, {
      hasColumns: (id) => {
        const t = tablesMap.get(id);
        return !!t && t.columns.length > 0;
      },
      columnCount: (id) => tablesMap.get(id)?.columns.length ?? 0,
      showColumns,
    });
    positioned.forEach((n) => {
      positionsRef.current.set(n.id, { x: n.position.x, y: n.position.y });
    });
    setNodes(positioned);
    // fit after layout on next tick
    setTimeout(() => rfInstance.fitView({ padding: 0.2 }), 50);
  }, [nodes, edges, showColumns, tablesMap, setNodes, rfInstance]);

  const handleFitView = useCallback(() => {
    rfInstance.fitView({ padding: 0.2 });
  }, [rfInstance]);

  if (!activeDbPath) {
    return (
      <EmptyState message="No database selected." />
    );
  }
  if (metadataQuery.isLoading && !metadata) {
    return (
      <div className="flex h-full flex-col gap-2 p-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="flex-1" />
      </div>
    );
  }
  if (tables.length === 0) {
    return (
      <EmptyState message="No tables to visualize. Open a database with tables." />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <VisualizationToolbar
        onFitView={handleFitView}
        onAutoLayout={handleAutoLayout}
        highlightRelationships={highlightRels}
        setHighlightRelationships={setHighlightRels}
        searchValue={search}
        onSearch={setSearch}
      />
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_e, node) => setSelectedTable(node.id)}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
          {showMinimap && (
            <MiniMap
              pannable
              zoomable
              nodeColor={() => "hsl(var(--primary) / 0.6)"}
              maskColor="hsl(var(--background) / 0.7)"
              style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            />
          )}
        </ReactFlow>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}