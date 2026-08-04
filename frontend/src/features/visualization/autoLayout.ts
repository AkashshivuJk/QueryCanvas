import type { Edge, Node } from "@xyflow/react";

/** Approximate width of a table card node. */
export const NODE_WIDTH = 240;
/** Header height of a table card. */
export const NODE_HEADER = 44;
/** Per-column row height inside a table card. */
export const COL_HEIGHT = 22;
/** Horizontal gap between columns (levels) in auto-layout. */
export const COL_GAP = 80;
/** Vertical gap between stacked nodes in the same column. */
export const ROW_GAP = 24;

/** Approximate the rendered height of a node from its data. */
function approxNodeHeight(
  node: Node,
  hasColumns: (id: string) => boolean,
  columnCount: (id: string) => number,
): number {
  const data = node.data as { showColumns?: boolean; compact?: boolean };
  if (data?.compact) {
    // compact: header + up to a few emphasized columns
    return NODE_HEADER + Math.max(1, Math.min(columnCount(node.id), 4)) * COL_HEIGHT;
  }
  if (!data?.showColumns || !hasColumns(node.id)) {
    return NODE_HEADER;
  }
  return NODE_HEADER + columnCount(node.id) * COL_HEIGHT;
}

/**
 * Deterministic auto-layout that positions tables in dependency columns
 * (topological levels by FK relationships) and falls back to a grid when the
 * dependency graph has cycles.
 *
 * Tables with no outgoing FKs land on the leftmost column; tables that
 * reference them land further right.
 */
export function autoLayout<T extends Node>(
  nodes: T[],
  edges: Edge[],
  opts: {
    hasColumns: (id: string) => boolean;
    columnCount: (id: string) => number;
    showColumns: boolean;
  },
): T[] {
  if (nodes.length === 0) return nodes;

  const ids = new Set(nodes.map((n) => n.id));

  // Adjacency: from -> [to]  (outgoing FKs only)
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  for (const n of nodes) {
    outgoing.set(n.id, new Set());
    incoming.set(n.id, new Set());
  }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    outgoing.get(e.source)?.add(e.target);
    incoming.get(e.target)?.add(e.source);
  }

  // Compute topological levels via outgoing references (DFS from sinks).
  // A node with no outgoing FKs is level 0 (leftmost). A node with outgoing FKs has
  // level = max(level of its referenced tables) + 1.
  const computed = new Map<string, number>();
  const visiting = new Set<string>();

  function computeLevel(id: string): number {
    if (computed.has(id)) return computed.get(id)!;
    if (visiting.has(id)) {
      // cycle: treat as level 0 to avoid infinite recursion
      return 0;
    }
    visiting.add(id);
    const outs = outgoing.get(id) ?? new Set<string>();
    if (outs.size === 0) {
      computed.set(id, 0);
      visiting.delete(id);
      return 0;
    }
    let max = 0;
    for (const t of outs) {
      const l = computeLevel(t);
      if (l + 1 > max) max = l + 1;
    }
    computed.set(id, max);
    visiting.delete(id);
    return max;
  }

  let hasCycle = false;
  for (const n of nodes) {
    computeLevel(n.id);
  }
  // Detect cycle: if a node was visited but never got a stable level during recursion,
  // or if processed count during Kahn was less than total. Use a simpler check: re-run Kahn.
  {
    const indeg = new Map<string, number>();
    for (const n of nodes) indeg.set(n.id, 0);
    for (const e of edges) {
      if (!ids.has(e.source) || !ids.has(e.target)) continue;
      indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    }
    const q: string[] = [];
    for (const [id, d] of indeg) if (d === 0) q.push(id);
    let count = 0;
    const deg = new Map(indeg);
    while (q.length) {
      const id = q.shift()!;
      count++;
      for (const t of outgoing.get(id) ?? []) {
        deg.set(t, (deg.get(t) ?? 0) - 1);
        if ((deg.get(t) ?? 0) === 0) q.push(t);
      }
    }
    hasCycle = count !== nodes.length;
  }

  // If there's a cycle, fall back to a grid layout.
  if (hasCycle) {
    return gridLayout(nodes, opts);
  }

  // Group nodes by level.
  const byLevel = new Map<number, string[]>();
  for (const n of nodes) {
    const l = computed.get(n.id) ?? 0;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l)!.push(n.id);
  }

  const maxLevel = Math.max(...byLevel.keys(), 0);
  const positions = new Map<string, { x: number; y: number }>();
  const colWidth = NODE_WIDTH + COL_GAP;

  for (let l = 0; l <= maxLevel; l++) {
    const idsInLevel = byLevel.get(l) ?? [];
    // Stack vertically, centered roughly around y=0.
    const heights = idsInLevel.map((id) => {
      const node = nodes.find((n) => n.id === id)!;
      return approxNodeHeight(node, opts.hasColumns, opts.columnCount);
    });
    const totalHeight =
      heights.reduce((a, b) => a + b, 0) + ROW_GAP * Math.max(0, idsInLevel.length - 1);
    let y = -totalHeight / 2;
    const x = l * colWidth;
    for (let i = 0; i < idsInLevel.length; i++) {
      positions.set(idsInLevel[i], { x, y });
      y += heights[i] + ROW_GAP;
    }
    // Rightmost column (max level) is on the right; leftmost (level 0) on the left.
  }

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) ?? n.position,
  }));
}

/** Grid fallback layout: sqrt(n) columns. */
export function gridLayout<T extends Node>(
  nodes: T[],
  opts: {
    hasColumns: (id: string) => boolean;
    columnCount: (id: string) => number;
    showColumns: boolean;
  },
): T[] {
  if (nodes.length === 0) return nodes;
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const colWidth = NODE_WIDTH + COL_GAP;
  const positions = new Map<string, { x: number; y: number }>();

  // Compute row heights per row to stagger properly.
  const sorted = [...nodes].sort((a, b) => a.id.localeCompare(b.id));
  const rowMaxHeight: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const row = Math.floor(i / cols);
    const h = approxNodeHeight(sorted[i], opts.hasColumns, opts.columnCount) + ROW_GAP;
    rowMaxHeight[row] = Math.max(rowMaxHeight[row] ?? 0, h);
  }

  const rowOffset: number[] = [0];
  for (let r = 1; r < rowMaxHeight.length; r++) {
    rowOffset[r] = rowOffset[r - 1] + rowMaxHeight[r - 1];
  }

  for (let i = 0; i < sorted.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(sorted[i].id, {
      x: col * colWidth,
      y: rowOffset[row] ?? 0,
    });
  }

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) ?? n.position,
  }));
}

/** Radial layout for the relationship graph: center node at origin, others in a circle. */
export function radialLayout<T extends Node>(
  nodes: T[],
  centerId: string,
  radius = 240,
): T[] {
  if (nodes.length === 0) return nodes;
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(centerId, { x: 0, y: 0 });

  const others = nodes.filter((n) => n.id !== centerId);
  const n = others.length;
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2;
    positions.set(others[i].id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
}