import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ReactFlowProvider } from "@xyflow/react";
import { useUIStore, type RightTab } from "@/store/useUIStore";
import { SchemaVisualization } from "./SchemaVisualization";
import { RelationshipGraph } from "./RelationshipGraph";

/** Right panel: tabbed schema visualization + relationship graph. */
export function RightPanel() {
  const rightTab = useUIStore((s) => s.rightTab);
  const setRightTab = useUIStore((s) => s.setRightTab);

  return (
    <ReactFlowProvider>
      <Tabs
        value={rightTab}
        onValueChange={(v) => setRightTab(v as RightTab)}
        className="h-full"
      >
        <div className="flex items-center gap-2 border-b border-border bg-card/40 px-2 py-2">
          <TabsList>
            <TabsTrigger value="visualization">Database Visualization</TabsTrigger>
            <TabsTrigger value="graph">Relationship Graph</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="visualization" className="min-h-0 flex-1">
          <SchemaVisualization />
        </TabsContent>
        <TabsContent value="graph" className="min-h-0 flex-1">
          <RelationshipGraph />
        </TabsContent>
      </Tabs>
    </ReactFlowProvider>
  );
}