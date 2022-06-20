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

const DocumentDownloadIcon = () => {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className="document-download"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      ></path>
    </svg>
  );
};

const JobNode = ({
  data,
  isConnectable,
  sourcePosition = Position.Bottom,
}: NodeProps) => {
  return (
    <div
      className="bg-white rounded-md shadow-sm 
                   ring-0.5 ring-black ring-opacity-5 
                   text-xs p-2 text-center h-full"
    >
      <div className={`flex items-center`}>
        <div className="flex-none w-6 text-slate-700 rounded-full bg-slate-300 p-1">
          <DocumentDownloadIcon />
        </div>
        <div className="flex-auto">{data?.label}</div>
      </div>
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
