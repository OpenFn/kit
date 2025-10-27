// WORKER_DISABLE_EXIT_LISTENERS=true clinic heapprofiler -- node clinic.js 1 --open false --collect-only
// start lightning: pnpm start --port 9991
import { getHeapStatistics } from 'node:v8';
import createWorker from './dist/index.js';
import createRTE from '@openfn/engine-multi';
import createLightningServer from '@openfn/lightning-mock';

import payload from './payload.json' with { type: 'json' };
import { createMockLogger } from '@openfn/logger';
const obj = JSON.stringify({
  data: payload.data,
  // This payload is too large for the lightning mock to consume
  // references: payload.references.slice(0,30)
  
  // seems OK
  references: payload.references.slice(0,10)
})
// const obj = JSON.stringify({ 
//   data: "<!doctype html>\n<html lang=\"en\" dir=\"ltr\" class=\"docs-wrapper plugin-docs plugin-id-default docs-version-current docs-doc-page docs-doc-id-get-started/home\" data-has-hydrated=\"false\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"generator\" content=\"Docusaurus v3.8.1\">\n<title data-rh=\"true\">What is OpenFn? | OpenFn/docs</title><meta data-rh=\"true\" name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta data-rh=\"true\" property=\"og:url\" content=\"https://docs.openfn.org/documentation\"><meta data-rh=\"true\" property=\"og:locale\" content=\"en\"><meta data-rh=\"true\" name=\"docusaurus_locale\" content=\"en\"><meta data-rh=\"true\" name=\"docsearch:language\" content=\"en\"><meta data-rh=\"true\" name=\"keywords\" content=\"OpenFn, workflow automation, ICT4D, integration, automation, documentation\"><meta data-rh=\"true\" name=\"twitter:card\" content=\"summary_large_image\"><meta data-rh=\"true\" name=\"twitter:site\" content=\"@openfn\"><meta data-rh=\"true\" name=\"twitter:title\" content=\"OpenFn Documentation\"><meta data-rh=\"true\" name=\"twitter:description\" content=\"The leading digital public good for workflow automation, OpenFn makes ICT4D more efficient.\"><meta data-rh=\"true\" name=\"twitter:image\" content=\"https://docs.openfn.org/img/og-image.png\"><meta data-rh=\"true\" name=\"docusaurus_version\" content=\"current\"><meta data-rh=\"true\" name=\"docusaurus_tag\" content=\"docs-default-current\"><meta data-rh=\"true\" name=\"docsearch:version\" content=\"current\"><meta data-rh=\"true\" name=\"docsearch:docusaurus_tag\" content=\"docs-default-current\"><meta data-rh=\"true\" property=\"og:title\" content=\"What is OpenFn? | OpenFn/docs\"><meta data-rh=\"true\" name=\"description\" content=\"OpenFn is the leading\"><meta data-rh=\"true\" property=\"og:description\" content=\"OpenFn is the leading\"><link data-rh=\"true\" rel=\"icon\" href=\"/img/favicon.ico\"><link data-rh=\"true\" rel=\"canonical\" href=\"https://docs.openfn.org/documentation\"><link data-rh=\"true\" rel=\"alternate\" href=\"https://docs.openfn.org/documentation\" hreflang=\"en\"><link data-rh=\"true\" rel=\"alternate\" href=\"https://docs.openfn.org/documentation\" hreflang=\"x-default\"><link data-rh=\"true\" rel=\"preconnect\" href=\"https://O729P2PJGT-dsn.algolia.net\" crossorigin=\"anonymous\"><script data-rh=\"true\" type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"BreadcrumbList\",\"itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"What is OpenFn?\",\"item\":\"https://docs.openfn.org/documentation/\"}]}</script><link rel=\"preconnect\" href=\"https://www.googletagmanager.com\">\n<script>window.dataLayer=window.dataLayer||[]</script>\n<script>!function(e,t,a,n){e[n]=e[n]||[],e[n].push({\"gtm.start\":(new Date).getTime(),event:\"gtm.js\"});var g=t.getElementsByTagName(a)[0],m=t.createElement(a);m.async=!0,m.src=\"https://www.googletagmanager.com/gtm.js?id=GTM-5RNRM5NC\",g.parentNode.insertBefore(m,g)}(window,document,\"script\",\"dataLayer\")</script>\n\n\n\n<link rel=\"search\" type=\"application/opensearchdescription+xml\" title=\"OpenFn/docs\" href=\"/opensearch.xml\">\n\n\n\n<link rel=\"alternate\" type=\"application/rss+xml\" href=\"/articles/rss.xml\" title=\"OpenFn Help Articles RSS Feed\">\n<link rel=\"alternate\" type=\"application/atom+xml\" href=\"/articles/atom.xml\" title=\"OpenFn Help Articles Atom Feed\">\n<link rel=\"alternate\" type=\"application/json\" href=\"/articles/feed.json\" title=\"OpenFn Help Articles JSON Feed\">\n\n\n<script data-jsd-embedded data-key=\"8583229a-a951-405e-b269-25a100d04641\" data-base-url=\"https://jsd-widget.atlassian.com\" src=\"https://jsd-widget.atlassian.com/assets/embed.js\" async></script><link rel=\"stylesheet\" href=\"/assets/css/styles.6e6ba625.css\">\n<script src=\"/assets/js/runtime~main.4051bba8.js\" defer=\"defer\"></script>\n<script src=\"/assets/js/main.59cb9e10.js\" defer=\"defer\"></script>\n</head>\n<body class=\"navigation-with-keyboard\">\n<noscript><iframe src=\"https://www.googletagmanager.com/ns.html?id=GTM-5RNRM5NC\" height=\"0\" width=\"0\" style=\"display:none;visibility:hidden\"></iframe></noscript>\n\n\n<svg xmlns=\"http://www.w3.org/2000/svg\" style=\"display: none;\"><defs>\n<symbol id=\"theme-svg-external-link\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"M21 13v10h-21v-19h12v2h-10v15h17v-8h2zm3-12h-10.988l4.035 4-6.977 7.07 2.828 2.828 6.977-7.07 4.125 4.172v-11z\"/></symbol>\n</defs></svg>\n<script>!function(){var t=\"light\";var e=function(){try{return new URLSearchParams(window.location.search).get(\"docusaurus-theme\")}catch(t){}}()||function(){try{return window.localStorage.getItem(\"theme\")}catch(t){}}();document.documentElement.setAttribute(\"data-theme\",e||t),document.documentElement.setAttribute(\"data-theme-choice\",e||t)}(),function(){try{const c=new URLSearchParams(window.location.search).entries();for(var[t,e]of c)if(t.startsWith(\"docusaurus-data-\")){var a=t.replace(\"docusaurus-data-\",\"data-\");document.documentElement.setAttribute(a,e)}}catch(t){}}()</script><div id=\"__docusaurus\"><div role=\"region\" aria-label=\"Skip to main content\"><a class=\"skipToContent_fXgn\" href=\"#__docusaurus_skipToContent_fallback\">Skip to main content</a></div><nav aria-label=\"Main\" class=\"theme-layout-navbar navbar navbar--fixed-top\"><div class=\"navbar__inner\"><div class=\"theme-layout-navbar-left navbar__items\"><button aria-label=\"Toggle navigation bar\" aria-expanded=\"false\" class=\"navbar__toggle clean-btn\" type=\"button\"><svg width=\"30\" height=\"30\" viewBox=\"0 0 30 30\" aria-hidden=\"true\"><path stroke=\"currentColor\" stroke-linecap=\"round\" stroke-miterlimit=\"10\" stroke-width=\"2\" d=\"M4 7h22M4 15h22M4 23h22\"></path></svg></button><a class=\"navbar__brand\" href=\"/\"><div class=\"navbar__logo\"><img src=\"/img/logo.svg\" alt=\"OpenFn\" class=\"themedComponent_mlkZ themedComponent--light_NVdE\"><img src=\"/img/logo.svg\" alt=\"OpenFn\" class=\"themedComponent_mlkZ themedComponent--dark_xIcU\"></div><b class=\"navbar__title text--truncate\">OpenFn</b></a><a aria-current=\"page\" class=\"navbar__item navbar__link navbar__link--active\" href=\"/documentation\">Docs</a><a class=\"navbar__item navbar__link\" href=\"/adaptors\">Adaptors</a><a class=\"navbar__item navbar__link\" href=\"/articles\">Articles</a></div><div class=\"theme-layout-navbar-right navbar__items navbar__items--right\"><div class=\"navbar__item dropdown dropdown--hoverable dropdown--right\"><a aria-current=\"page\" class=\"navbar__link active\" aria-haspopup=\"true\" aria-expanded=\"false\" role=\"button\" href=\"/documentation\">v2 ⚡</a><ul class=\"dropdown__menu\"><li><a aria-current=\"page\" class=\"dropdown__link dropdown__link--active\" href=\"/documentation\">v2 ⚡</a></li><li><a class=\"dropdown__link\" href=\"/documentation/legacy\">v1.105</a></li></ul></div><a href=\"https://github.com/openfn/docs\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"navbar__item navbar__link header-github-link\" aria-label=\"GitHub repository\"></a><div class=\"toggle_vylO colorModeToggle_DEke\"><button class=\"clean-btn toggleButton_gllP toggleButtonDisabled_aARS\" type=\"button\" disabled=\"\" title=\"system mode\" aria-label=\"Switch between dark and light mode (currently system mode)\"><svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" aria-hidden=\"true\" class=\"toggleIcon_g3eP lightToggleIcon_pyhR\"><path fill=\"currentColor\" d=\"M12,9c1.65,0,3,1.35,3,3s-1.35,3-3,3s-3-1.35-3-3S10.35,9,12,9 M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5 S14.76,7,12,7L12,7z M2,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S1.45,13,2,13z M20,13l2,0c0.55,0,1-0.45,1-1 s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S19.45,13,20,13z M11,2v2c0,0.55,0.45,1,1,1s1-0.45,1-1V2c0-0.55-0.45-1-1-1S11,1.45,11,2z M11,20v2c0,0.55,0.45,1,1,1s1-0.45,1-1v-2c0-0.55-0.45-1-1-1C11.45,19,11,19.45,11,20z M5.99,4.58c-0.39-0.39-1.03-0.39-1.41,0 c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0s0.39-1.03,0-1.41L5.99,4.58z M18.36,16.95 c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41 L18.36,16.95z M19.42,5.99c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06c-0.39,0.39-0.39,1.03,0,1.41 s1.03,0.39,1.41,0L19.42,5.99z M7.05,18.36c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06 c-0.39,0.39-0.39,1.03,0,1.41s1.03,0.39,1.41,0L7.05,18.36z\"></path></svg><svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" aria-hidden=\"true\" class=\"toggleIcon_g3eP darkToggleIcon_wfgR\"><path fill=\"currentColor\" d=\"M9.37,5.51C9.19,6.15,9.1,6.82,9.1,7.5c0,4.08,3.32,7.4,7.4,7.4c0.68,0,1.35-0.09,1.99-0.27C17.45,17.19,14.93,19,12,19 c-3.86,0-7-3.14-7-7C5,9.07,6.81,6.55,9.37,5.51z M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36 c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z\"></path></svg><svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" aria-hidden=\"true\" class=\"toggleIcon_g3eP systemToggleIcon_QzmC\"><path fill=\"currentColor\" d=\"m12 21c4.971 0 9-4.029 9-9s-4.029-9-9-9-9 4.029-9 9 4.029 9 9 9zm4.95-13.95c1.313 1.313 2.05 3.093 2.05 4.95s-0.738 3.637-2.05 4.95c-1.313 1.313-3.093 2.05-4.95 2.05v-14c1.857 0 3.637 0.737 4.95 2.05z\"></path></svg></button></div><div class=\"navbarSearchContainer_Bca1\"><button type=\"button\" class=\"DocSearch DocSearch-Button\" aria-label=\"Search (Command+K)\"><span class=\"DocSearch-Button-Container\"><svg width=\"20\" height=\"20\" class=\"DocSearch-Search-Icon\" viewBox=\"0 0 20 20\" aria-hidden=\"true\"><path d=\"M14.386 14.386l4.0877 4.0877-4.0877-4.0877c-2.9418 2.9419-7.7115 2.9419-10.6533 0-2.9419-2.9418-2.9419-7.7115 0-10.6533 2.9418-2.9419 7.7115-2.9419 10.6533 0 2.9419 2.9418 2.9419 7.7115 0 10.6533z\" stroke=\"currentColor\" fill=\"none\""
// })

let lng;
let worker;
let idgen = 1;

const WORKFLOW_COUNT = 1e6;
let workflowsFinished = 0;

setInterval(() => {
  heap('POLL');
}, 1000);

await setup();
heap('SETUP');
await test();


function heap(reason) {
  const { used_heap_size } = getHeapStatistics();
  const mb = used_heap_size / 1024 / 1024;
  console.log(`>> [${reason}] Used heap at ${mb.toFixed(2)}mb`);
}

// start the server
async function setup() {
  const engineOptions = {
    repoDir: process.env.OPENFN_REPO_DIR,
    maxWorkers: 4,
    logger: createMockLogger()
  };

  const engine = await createRTE(engineOptions);

  // TODO best to keep this out of process as it also uses memory
  // lng = createLightningServer({
  //   port: 9991,
  // });

  worker = createWorker(engine, {
    port: 9992,
    lightning: 'ws://localhost:9991/worker',
    maxWorkflows: 4,
    backoff: {
      min: 10,
      max: 5e4,

      // min: 5000,
      // max: 1e6,
    },
    logger: createMockLogger()
  });

  worker.on('workflow-complete', (evt) => {
    heap('WORKFLOW:COMPLETE');
    if (++workflowsFinished === WORKFLOW_COUNT) {
      console.log('>> all done!');
      // console.log('>> Hit CTRL+C to exit and generate heap profile');
      // process.send('SIGINT');
      // process.abort();
      process.exit(0);
    }
  });
}

// send a bunch of jobs through
async function test() {
  const sleep = (duration = 100) =>
    new Promise((resolve) => setTimeout(resolve, duration));

  let count = 0;
  const max = 1;

  while (count++ < WORKFLOW_COUNT) {
    const w = wf();
    await fetch(`http://localhost:9991/run`, {
      method: 'POST',
      body: JSON.stringify(w),
      headers: {
        'content-type': 'application/json',
      },
      keepalive: true,

    });
    // await sleep(5 * 1000);
    await sleep(500);
  }
}



function wf() {
  const step = `
export default [() => {
  return ${obj};
}]`;
  return {
    id: `run-${idgen++}`,
    triggers: [],
    edges: [],
    jobs: [
      {
        id: 'a',
        body: step,
      },
    ],
  };
}
