import type { EdgeProps } from "@xyflow/react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
} from "@xyflow/react";
import type { RelEdgeData } from "./types";

/** Custom edge with a styled label used by the relationship graph. */
export function LabeledEdge(props: EdgeProps) {
  const data = (props.data ?? {}) as RelEdgeData;
  const sourceX = props.sourceX;
  const sourceY = props.sourceY;
  const sourcePosition = (props.sourcePosition ?? Position.Right) as Position;
  const targetX = props.targetX;
  const targetY = props.targetY;
  const targetPosition = (props.targetPosition ?? Position.Left) as Position;

  const edgeType = props.type ?? "default";
  let result: [string, number, number];
  if (edgeType === "straight") {
    const r = getStraightPath({ sourceX, sourceY, targetX, targetY });
    result = [r[0], r[1], r[2]];
  } else if (edgeType === "step") {
    const r = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    result = [r[0], r[1], r[2]];
  } else {
    const r = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    result = [r[0], r[1], r[2]];
  }
  const [path, labelX, labelY] = result;

  const color = data.direction === "in" ? "hsl(142 71% 45%)" : "hsl(217 91% 60%)";

  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} />
      {data.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              padding: "1px 5px",
              borderRadius: 4,
              fontSize: 10,
              pointerEvents: "none",
              color,
            }}
            className="nopan nodrag"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}