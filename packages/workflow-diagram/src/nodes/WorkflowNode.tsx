import React, { memo } from "react";

import { Handle, Position } from "react-flow-renderer";
import type { NodeProps } from "react-flow-renderer";
import cc from "classcat";

const WorkflowNode = ({
  data,
  isConnectable,
  targetPosition = Position.Top,
  sourcePosition = Position.Bottom,
}: NodeProps) => {
  return (
    <div
      className={cc([
        "text-xs",
        "p-2",
        "text-center",
        "h-full",
        "border-2",
        "border-dashed",
        "rounded-md",
      ])}
    >
      <Handle
        type="target"
        position={targetPosition}
        isConnectable={isConnectable}
        style={{ border: "none", height: 0, top: 0 }}
      />

      <div className={`flex h-full ${data.hasChildren ? "" : "items-center"}`}>
        <div className="flex-auto">{data?.label}</div>
      </div>
      <Handle
        type="source"
        position={sourcePosition}
        isConnectable={isConnectable}
        style={{ border: "none", height: 0, top: 0 }}
      />
    </div>
  );
};

WorkflowNode.displayName = "WorkflowNode";

export default memo(WorkflowNode);
