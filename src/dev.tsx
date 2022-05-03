import React from "react";
import ReactDOM from "react-dom";
import App from "./index";

ReactDOM.render(
  <div className="h-screen w-screen">
    <div className="flex h-full">
      <div className="flex-none bg-slate-500 w-14 h-full"></div>
      <div className="flex-1 bg-slate-300">
        <App foo="Whats up bud... harzit" />
      </div>
    </div>
  </div>,
  document.getElementById("root")
);
