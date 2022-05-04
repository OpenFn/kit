import React, { memo } from "react";

import { Handle } from "react-flow-renderer";

export default memo(({ data, isConnectable }) => {
  return (
    <>
      <div className="flex rounded-full  border ring ring-offset-2 ring-black bg-green-500 border-black h-16 w-16 items-center justify-center text-center text-xs">
        { data.label }
      </div>
      <Handle
        type="source"
        position="bottom"
        id="a"
        className="!left-1/2 !bg-black !border-1 !-bottom-2"
        isConnectable={isConnectable}
      />
    </>
  );
});
