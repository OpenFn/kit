import React, { memo } from "react";

import { Handle, Position } from "react-flow-renderer";
import type { NodeProps } from "react-flow-renderer";
import cc from "classcat";

// background:#fff
// border:1px solid #1a192b
// border-radius:3px
// color:#222
// font-size:12px
// padding:10px
// text-align:center
// width:150px

const WorkflowNode = ({
  data,
  isConnectable,
  selected,
  targetPosition = Position.Top,
  sourcePosition = Position.Bottom,
}: NodeProps) => {
  return (
    <div
      className={cc([
        selected ? "ring-2" : "ring-0.5",
        selected ? "ring-indigo-500" : "ring-black",
        selected ? "ring-opacity-20" : "ring-opacity-5",
        "text-xs",
        "p-2",
        "text-center",
        "h-full",
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
