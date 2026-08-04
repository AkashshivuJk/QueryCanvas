import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useMetadata } from "@/hooks/useDatabase";
import { useUIStore } from "@/store/useUIStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { TableNode } from "./TableNode";
import { LabeledEdge } from "./LabeledEdge";
import { radialLayout } from "./autoLayout";
import { allTables, tableMap } from "./buildGraph";
import type { RelEdgeData, TableNode as TableNodeType } from "./types";

const nodeTypes = { tableNode: TableNode };
const edgeTypes = { labeled: LabeledEdge };

const OUT_COLOR = "hsl(217 91% 60%)"; // outgoing: blue
const IN_COLOR = "hsl(142 71% 45%)"; // incoming: green

/** Focused relationship graph centered on the selected table. */
export function RelationshipGraph() {
  const activeDbPath = useDatabaseStore((s) => s.activeDbPath);
  const metadataQuery = useMetadata(activeDbPath);
  const metadata = metadataQuery.data;
  const selectedTableName = useUIStore((s) => s.selectedTableName);
  const setSelectedTable = useUIStore((s) => s.setSelectedTable);
  const setRightTab = useUIStore((s) => s.setRightTab);
  const animationSpeed = useSettingsStore((s) => s.animationSpeed);
  const showColumns = useSettingsStore((s) => s.showColumns);

  const [nodes, setNodes, onNodesChange] = useNodesState<TableNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const rf = useReactFlow();
  const [version, setVersion] = useState(0);

  const tables = useMemo(() => (metadata ? allTables(metadata) : []), [metadata]);
  const tMap = useMemo(() => tableMap(tables), [tables]);
  const selectedTable = selectedTableName ? tMap.get(selectedTableName) : null;

  // Build the focused sub-graph whenever the selected table or metadata changes.
  useEffect(() => {
    if (!selectedTable) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Outgoing FKs: this table references others.
    const outFks = selectedTable.foreign_keys.map((fk) => ({
      to: fk.to_table,
      fk,
    }));
    // Incoming FKs: other tables reference this one.
    const inFks: Array<{ from: string; fk: typeof outFks[number]["fk"] }> = [];
    for (const t of tables) {
      for (const fk of t.foreign_keys) {
        if (fk.to_table === selectedTable.name) {
          inFks.push({ from: t.name, fk });
        }
      }
    }

    const relatedNames = new Set<string>();
    for (const o of outFks) if (tMap.has(o.to)) relatedNames.add(o.to);
    for (const i of inFks) if (tMap.has(i.from)) relatedNames.add(i.from);

    const involved = [selectedTable.name, ...Array.from(relatedNames)];

    const buildNode = (name: string): TableNodeType => {
      const t = tMap.get(name)!;
      const isCenter = name === selectedTable.name;
      const emphasize = new Set<string>();
      if (isCenter) {
        for (const fk of selectedTable.foreign_keys) emphasize.add(fk.from_column);
      } else {
        // For related tables, emphasize the FK column involved.
        for (const o of outFks) {
          if (o.to === name) emphasize.add(o.fk.to_column);
        }
        for (const i of inFks) {
          if (i.from === name) emphasize.add(i.fk.from_column);
        }
      }
      return {
        id: name,
        type: "tableNode",
        position: { x: 0, y: 0 },
        data: {
          table: t,
          highlight: false,
          showColumns,
          compact: !isCenter,
          focused: isCenter,
          emphasizeColumns: emphasize,
        },
        draggable: true,
      };
    };

    const rawNodes = involved.map(buildNode);
    const positioned = radialLayout(rawNodes, selectedTable.name, 240);
    setNodes(positioned);

    const dash =
      animationSpeed === "slow" ? "12 8" : animationSpeed === "fast" ? "2 4" : "6 6";
    const newEdges: Edge[] = [];
    for (const o of outFks) {
      if (!tMap.has(o.to)) continue;
      const data: RelEdgeData = {
        label: `${o.fk.from_column} → ${o.fk.to_table}.${o.fk.to_column}`,
        direction: "out",
      };
      newEdges.push({
        id: `out_${selectedTable.name}_${o.fk.from_column}__${o.to}_${o.fk.to_column}`,
        source: selectedTable.name,
        target: o.to,
        type: "labeled",
        animated: true,
        data,
        style: {
          stroke: OUT_COLOR,
          strokeWidth: 2,
          strokeDasharray: dash,
        },
      });
    }
    for (const i of inFks) {
      if (!tMap.has(i.from)) continue;
      const data: RelEdgeData = {
        label: `${i.from}.${i.fk.from_column} → ${i.fk.to_column}`,
        direction: "in",
      };
      newEdges.push({
        id: `in_${i.from}_${i.fk.from_column}__${selectedTable.name}_${i.fk.to_column}`,
        source: i.from,
        target: selectedTable.name,
        type: "labeled",
        animated: true,
        data,
        style: {
          stroke: IN_COLOR,
          strokeWidth: 2,
          strokeDasharray: dash,
        },
      });
    }
    setEdges(newEdges);
    setVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, tables, tMap, animationSpeed, showColumns]);

  // Fit view after the graph rebuilds.
  useEffect(() => {
    if (nodes.length > 0) {
      const id = setTimeout(() => rf.fitView({ padding: 0.25 }), 60);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [version, nodes.length, rf]);

  const onNodeClick = useCallback(
    (_e: unknown, node: Node) => {
      if (node.id !== selectedTableName) setSelectedTable(node.id);
    },
    [selectedTableName, setSelectedTable],
  );

  if (!activeDbPath) {
    return <EmptyState message="No database selected." />;
  }
  if (metadataQuery.isLoading && !metadata) {
    return (
      <div className="flex h-full flex-col gap-2 p-4">
        <div className="h-9" />
        <div className="flex-1 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }
  if (!selectedTableName || !selectedTable) {
    return (
      <EmptyState message="Select a table from the explorer to see its relationships." />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-card/40 px-2 py-2">
        <Button size="sm" variant="outline" onClick={() => setRightTab("visualization")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to full schema
        </Button>
        <span className="text-xs text-muted-foreground">
          Center: <span className="font-medium text-foreground">{selectedTable.name}</span>
          <span className="ml-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: OUT_COLOR }} /> outgoing
          <span className="ml-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: IN_COLOR }} /> incoming
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
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