import React, { memo } from "react";

import cc from "classcat";
import { NodeData } from "layout/types";
import type { NodeProps } from "react-flow-renderer";
import { Handle, Position } from "react-flow-renderer";

const WorkflowNode = ({
  data,
  isConnectable,
  selected,
  targetPosition = Position.Top,
  sourcePosition = Position.Bottom,
}: NodeProps<NodeData>) => {
  return (
    <div
      className={cc([
        "border-2",
        "border-dashed",
        "h-full",
        "p-2",
        "rounded-md",
        "text-center",
        "text-xs",
        selected ? "border-indigo-500 border-opacity-20" : false,
      ])}
    >
      <Handle
        type="target"
        position={targetPosition}
        isConnectable={isConnectable}
        style={{ border: "none", height: 0, top: 0 }}
      />

      <div className="flex h-full items-start cursor-pointer">
        <div
          className={cc([
            "flex-auto",
            !data.label
              ? [
                  "decoration-1",
                  "decoration-dashed",
                  "decoration-slate-300",
                  "italic",
                  "text-gray-400",
                  "underline",
                  "underline-offset-2",
                ]
              : false,
          ])}
        >
          {data.label ? data.label : "untitled"}
        </div>
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
