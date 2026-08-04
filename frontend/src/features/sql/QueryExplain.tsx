import { motion } from "framer-motion";
import { Lightbulb, AlertTriangle, Database, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExplainPlanRow, ExplainResult } from "@/types";

interface ExplainNode {
  row: ExplainPlanRow;
  children: ExplainNode[];
}

function buildTree(plan: ExplainPlanRow[]): ExplainNode[] {
  const byId = new Map<number, ExplainNode>();
  plan.forEach((row) => byId.set(row.id, { row, children: [] }));
  const roots: ExplainNode[] = [];
  for (const row of plan) {
    const node = byId.get(row.id)!;
    if (row.parent === 0 || row.parent === -1) {
      roots.push(node);
    } else {
      const parent = byId.get(row.parent);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }
  return roots;
}

function PlanNode({ node, depth }: { node: ExplainNode; depth: number }) {
  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="border-l border-border pl-2 py-0.5">
        <span className="text-xs text-muted-foreground">#{node.row.id}</span>{" "}
        <span className="font-mono text-xs">{node.row.detail}</span>
      </div>
      {node.children.map((child) => (
        <PlanNode key={child.row.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

interface QueryExplainProps {
  explain: ExplainResult | null;
  isExplaining: boolean;
}

export function QueryExplain({ explain, isExplaining }: QueryExplainProps) {
  if (isExplaining) {
    return (
      <div className="flex h-full flex-col gap-1.5 p-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!explain) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Gauge className="h-8 w-8 opacity-40" />
        <span>Click "Explain" in the toolbar to analyze the query plan.</span>
      </div>
    );
  }

  const tree = buildTree(explain.plan);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full min-h-0 flex-col overflow-auto p-3 text-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Estimated cost:</span>
        <Badge variant="secondary" className="font-mono">{explain.estimated_cost.toFixed(2)}</Badge>
      </div>

      {explain.indexes_used.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-xs font-medium">Indexes used</div>
          <div className="flex flex-wrap gap-1.5">
            {explain.indexes_used.map((idx, i) => (
              <Badge key={i} variant="default" className="gap-1">
                <Database className="h-3 w-3" /> {idx}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3">
        <div className="mb-1.5 text-xs font-medium">Execution Plan</div>
        <div className="rounded-md border border-border bg-muted/30 p-2">
          {tree.map((node) => (
            <PlanNode key={node.row.id} node={node} depth={0} />
          ))}
        </div>
      </div>

      {explain.suggestions.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-xs font-medium">Suggestions</div>
          <ul className="space-y-1.5">
            {explain.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {explain.potential_problems.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-xs font-medium">Potential Problems</div>
          <ul className="space-y-1.5">
            {explain.potential_problems.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}