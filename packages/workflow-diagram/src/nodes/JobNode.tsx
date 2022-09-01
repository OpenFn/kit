import React, { memo } from "react";

import cc from "classcat";
import type { NodeProps } from "react-flow-renderer";
import { Handle, Position } from "react-flow-renderer";
import { NodeData } from "layout/types";

const JobNode = ({
  data,
  isConnectable,
  selected,
  targetPosition = Position.Top,
  sourcePosition = Position.Bottom,
}: NodeProps<NodeData>) => {
  return (
    <div
      className={cc([
        "bg-white",
        "cursor-pointer",
        "h-full",
        "p-2",
        "rounded-md",
        "shadow-sm",
        "text-center",
        "text-xs",
        selected ? "ring-2" : "ring-0.5",
        selected ? "ring-indigo-500" : "ring-black",
        selected ? "ring-opacity-20" : "ring-opacity-5",
      ])}
    >
      <Handle
        type="target"
        position={targetPosition}
        isConnectable={isConnectable}
        style={{ border: "none", height: 0, top: 0 }}
      />

      <div
        className={cc([
          "flex",
          "h-full",
          !data.hasChildren ? "items-center" : false,
        ])}
      >
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

JobNode.displayName = "JobNode";

export default memo(JobNode);
