import React from "react";
import App from "./index";
import { createRoot } from "react-dom/client";

const root = createRoot(document.getElementById("root"));

root.render(
  <div className="h-screen w-screen">
    <div className="flex h-full">
      <div className="flex-none bg-slate-500 w-14 h-full"></div>
      <div className="flex-1 bg-slate-50">
        <App foo="Whats up bud... harzit" />
      </div>
    </div>
  </div>
);
