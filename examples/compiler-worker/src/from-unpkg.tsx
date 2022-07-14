import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

import "./app.css";
import { StatusIcon, FuncIcon } from "./icons";
import { Pack, Project, describeDts } from "@openfn/compiler";

const packageOrDts = /(?:package.json)|(?:\.d\.ts$)/i;
const moduleOptions = ["@openfn/language-common@2.0.0-rc1"];

function WorkerInspector() {
  const [project, setProject] = useState<Project | null>(null);
  const [pack, setPack] = useState<Pack | null>(null);
  const [selectedModule, setSelectedModule] = useState(moduleOptions[0]);
  const [filesLoaded, setFilesLoaded] = useState<boolean>(false);
  const [describeError, setDescribeError] = useState(null);
  const [describeResults, setDescribeResults] = useState<ReturnType<
    typeof describeDts
  > | null>(null);
  const [timers, setTimers] = useState({
    projectCreated: null,
    filesLoaded: null,
    describeAdaptor: null,
  });

  useEffect(() => {
    const createProjectStart = performance.now();
    setProject(new Project());
    setTimers({
      ...timers,
      projectCreated: performance.now() - createProjectStart,
    });
  }, []);

  useEffect(() => {
    (async () => {
      if (project) {
        const filesLoadedStart = performance.now();

        const _pack = await Pack.fromUnpkg("@openfn/language-common@2.0.0-rc1");

        const files = await _pack.getFiles(
          _pack.fileListing.filter((path) => packageOrDts.test(path))
        );

        project.addToFS(files);
        project.createFile(files.get(_pack.types)!, _pack.types);

        setPack(_pack);
        setFilesLoaded(true);
        setTimers({
          ...timers,
          filesLoaded: performance.now() - filesLoadedStart,
        });
      }
    })();
  }, [project]);

  console.log(timers);

  useEffect(() => {
    if (filesLoaded) {
      (async function () {
        try {
          const describeAdaptorStart = performance.now();
          console.log(project);

          const results = describeDts(project, pack.types);
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
  }, [filesLoaded]);

  function handleModuleChange(value) {
    setSelectedModule(value.target.value);
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg mt-5">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          DTS Inspection
        </h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          <label
            htmlFor="module-specifier"
            className="block text-sm font-medium text-gray-700"
          >
            Module
          </label>
          <select
            id="module-specifier"
            name="module-specifier"
            autoComplete="module-specifier-name"
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={selectedModule}
            onChange={handleModuleChange}
          >
            {moduleOptions.map((moduleName) => (
              <option value={moduleName}>{moduleName}</option>
            ))}
          </select>
        </p>
      </div>
      <div className="border-t border-gray-200">
        <dl>
          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">Info</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              <StatusIcon success={project} />
              <span className="ml-1 inline-block align-middle">
                Project Created{" "}
                {timers.projectCreated
                  ? `(${Math.round(timers.projectCreated)}ms)`
                  : null}
              </span>

              <br />
              <StatusIcon success={filesLoaded} />
              <span className="ml-1 inline-block align-middle">
                Files Loaded{" "}
                {timers.filesLoaded
                  ? `(${Math.round(timers.filesLoaded)}ms)`
                  : null}
              </span>
            </dd>
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

const root = createRoot(document.getElementById("root")!);

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
