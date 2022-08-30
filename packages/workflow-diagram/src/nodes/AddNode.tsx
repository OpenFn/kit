import React, { memo } from "react";

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

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

const AddNode = ({
  // data,
  isConnectable,
  targetPosition = Position.Top,
}: NodeProps) => {
  return (
    <div className="rounded-full text-xs text-center h-full cursor-pointer">
      <Handle
        type="target"
        position={targetPosition}
        isConnectable={isConnectable}
        style={{ border: "none", height: 0, top: 0 }}
      />

      <div className="flex items-center">
        <div className="flex-none w-6 text-slate-500 hover:text-slate-700">
          <PlusIcon />
        </div>
      </div>
    </div>
  );
};

AddNode.displayName = "AddNode";

export default memo(AddNode);
