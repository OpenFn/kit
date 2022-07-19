import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

import "./app.css";
import { DTSArea } from "./dts-area";
import { StatusIcon, FuncIcon } from "./icons";

function WorkerInspector() {
  const [workerState, setWorkerState] = useState({
    loading: false,
    loaded: false,
  });

  const [worker, setWorker] = useState(null);
  const [projectCreated, setProjectCreated] = useState(false);
  const [describeError, setDescribeError] = useState(null);
  const [describeResults, setDescribeResults] = useState(null);
  const [astText, setAstText] = useState(null);
  const [timers, setTimers] = useState({
    workerLoaded: null,
    projectCreated: null,
    describeAdaptor: null,
  });

  useEffect(() => {
    setWorkerState({ loading: true, loaded: false });

    const workerImportStart = performance.now();
    import("@openfn/compiler/worker")
      .then(async ({ startWorker }) => {
        setWorkerState({ loading: false, loaded: true });
        setWorker(await startWorker());
        setTimers({ workerLoaded: performance.now() - workerImportStart });
      })
      .catch(console.error.bind(console));
  }, []);

  useEffect(() => {
    if (!astText) {
      fetch("public/language-common.d.ts").then(async (resp) => {
        setAstText(await resp.text());
      });
    }
  }, [astText]);

  useEffect(() => {
    (async () => {
      if (worker) {
        const createProjectStart = performance.now();
        await worker.createProject();
        setTimers({
          ...timers,
          projectCreated: performance.now() - createProjectStart,
        });
        setProjectCreated(true);
      }
    })();
  }, [worker]);

  useEffect(() => {
    if (projectCreated) {
      (async function () {
        try {
          const describeAdaptorStart = performance.now();
          const results = await worker.describeAdaptor(astText);
          setTimers({
            ...timers,
            describeAdaptor: performance.now() - describeAdaptorStart,
          });
          setDescribeError(null);
          setDescribeResults(results);
          console.log(results);
        } catch (error) {
          setDescribeError(error);
          setDescribeResults(null);
          console.log(error);
        }
      })();
    }
  }, [astText, projectCreated]);

  function handleDtsChange(value) {
    setAstText(value);
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg mt-5">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          DTS Inspection
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Enter a DTS to inspect.
        </p>
      </div>
      <div className="border-t border-gray-200">
        <dl>
          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Worker</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              <StatusIcon success={workerState.loaded} />
              <span className="ml-1 inline-block align-middle">
                Loaded{" "}
                {timers.workerLoaded
                  ? `(${Math.round(timers.workerLoaded)}ms)`
                  : null}
              </span>

              <br />
              <StatusIcon success={projectCreated} />
              <span className="ml-1 inline-block align-middle">
                Project Created{" "}
                {timers.projectCreated
                  ? `(${Math.round(timers.projectCreated)}ms)`
                  : null}
              </span>
            </dd>
          </div>
          <div className="bg-white px-4 py-5 ">
            <div className="text-sm font-medium text-gray-500 mb-2">
              DTS File Contents
            </div>
            <DTSArea onChange={handleDtsChange} defaultValue={astText} />
          </div>
          {describeError ? (
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Error</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {describeError.toString()}
              </dd>
            </div>
          ) : (
            <></>
          )}

          {describeResults ? (
            <div className="bg-white px-4 py-5 pt-2">
              <dt className="text-sm font-medium text-gray-500">
                Exported Functions&nbsp;
                {timers.describeAdaptor
                  ? `(${Math.round(timers.describeAdaptor)}ms)`
                  : null}
              </dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <ul
                  role="list"
                  className="border border-gray-200 rounded-md divide-y divide-gray-200 mt-2"
                >
                  {describeResults.map((sym) => (
                    <SymbolListItem symbol={sym} key={sym.name} />
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));

root.render(
  <div className="w-full h-full">
    <div className="flex content-center bg-slate-200">
      <div className="basis-8/12 mx-auto mb-5">
        <WorkerInspector />
      </div>
    </div>
  </div>
);
function SymbolListItem({ symbol }) {
  return (
    <li className="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
      <div className="w-0 flex-1 flex items-center">
        <FuncIcon />
        <span className="ml-2 flex-1 w-0 truncate font-mono">
          {symbol.name}
        </span>
      </div>
      <div className="w-0 basis-3/4 flex items-center">
        <span className="ml-2 flex-1 w-0" style={{ whiteSpace: "pre-wrap" }}>
          {symbol.comment}
        </span>
      </div>
    </li>
  );
}
