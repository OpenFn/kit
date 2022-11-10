import runtime from 'react-refresh/runtime';
import React from 'react';
import { createRoot } from 'react-dom/client';
// import AdaptorDocs from '@openfn/adaptor-docs';

runtime.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => type => type;

setInterval(() => {
  runtime.performReactRefresh()
  console.log('refresh')
}, 1000);

const root = createRoot(document.getElementById("root"));

root.render(
  // <AdaptorDocs />
  <div>hello world!</div>
);