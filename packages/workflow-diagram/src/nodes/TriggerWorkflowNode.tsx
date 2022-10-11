import React, { memo } from "react";

import { Handle, Position } from "react-flow-renderer";
import type { NodeProps } from "react-flow-renderer";

const TriggerWorkflowNode = ({
  data,
  isConnectable,
  sourcePosition = Position.Bottom,
}: NodeProps) => {
  return (
    <div
      className="bg-white cursor-pointer h-full p-2 rounded-md shadow-sm
        text-center text-xs ring-0.5 ring-black ring-opacity-5"
    >
      <div className={`flex flex-col items-center w-full`}>
        <div className="flex-auto">{data?.workflow?.name}</div>
        <div
          className="flex-auto text-[0.6rem] italic whitespace-nowrap text-ellipsis w-full overflow-hidden"
          title={data?.description}
        >
          {data?.description}
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

TriggerWorkflowNode.displayName = "TriggerWorkflowNode";

export default memo(TriggerWorkflowNode);
