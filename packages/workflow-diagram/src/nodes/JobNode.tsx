import React, { memo, SyntheticEvent, useCallback } from "react";

import { Handle, Position } from "react-flow-renderer";
import type { NodeProps } from "react-flow-renderer";

// background:#fff
// border:1px solid #1a192b
// border-radius:3px
// color:#222
// font-size:12px
// padding:10px
// text-align:center
// width:150px

const JobNode = ({
  data,
  isConnectable,
  targetPosition = Position.Top,
  sourcePosition = Position.Bottom,
}: NodeProps) => {
  const handleClick = useCallback((e: SyntheticEvent) => {
    const evt = new CustomEvent("node-clicked", {
      bubbles: true,
      detail: data,
    });

    e.target.dispatchEvent(evt);
  }, []);

  return (
    <div
      className="background-white border border-slate-700 w-[150px] 
                    rounded-md text-xs p-2 text-center h-full"
      onClick={handleClick}
    >
      <Handle
        type="target"
        position={targetPosition}
        isConnectable={isConnectable}
      />
      {data?.label}
      <Handle
        type="source"
        position={sourcePosition}
        isConnectable={isConnectable}
      />
    </div>
  );
};

JobNode.displayName = "JobNode";

export default memo(JobNode);
