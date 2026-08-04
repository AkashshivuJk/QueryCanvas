import type { Edge, Node } from "@xyflow/react";
import type { TableInfo } from "@/types";

/** Node data payload for a table card node. */
export interface TableNodeData {
  table: TableInfo;
  highlight: boolean;
  showColumns: boolean;
  /** Compact mode: show only header + FK columns (used by relationship graph). */
  compact: boolean;
  /** When true, node is the focused center of a relationship graph. */
  focused: boolean;
  /** Set of column names to emphasize in compact mode (the FK columns). */
  emphasizeColumns: Set<string>;
  [key: string]: unknown;
}

export type TableNode = Node<TableNodeData, "tableNode">;
export type TableEdge = Edge;

/** Edge data for the relationship graph (carries a label + direction). */
export interface RelEdgeData {
  label: string;
  direction: "out" | "in";
  [key: string]: unknown;
}