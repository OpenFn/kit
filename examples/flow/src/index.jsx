import WorkflowDiagram, { Store } from '@openfn/workflow-diagram';

import React from 'react';
import { createRoot } from 'react-dom/client';
import cc from 'classcat';

import './app.css';
import '@openfn/workflow-diagram/index.css'

const projectSpace = {
  jobs: [
    {
      id: 'A',
      name: 'Job A',
      workflowId: 'wf-one',
      adaptor: '@openfn/language-salesforce@2.8.1',
      enabled: true,
      trigger: {
        type: 'webhook',
        webhookUrl:
          'https://demo.openfn.org/i/34f843bd-eb87-4833-b32a-905139534d5a',
      },
      operations: [
        { id: '115', label: 'create', comment: 'Create an object' },
        { id: '25', label: 'fn', comment: 'Map out new records' },
        { id: '35', label: 'upsert', comment: 'Upsert results' },
      ],
    },
    {
      id: 'B',
      name: 'Job B',
      workflowId: 'wf-one',
      adaptor: '@openfn/language-salesforce@0.2.2',
      enabled: true,
      trigger: { type: 'on_job_failure', upstreamJob: 'E' },
    },
    {
      id: 'C',
      name: 'Job C',
      workflowId: 'wf-one',
      adaptor: '@openfn/language-dhis2@0.3.5',
      enabled: true,
      trigger: { type: 'on_job_success', upstreamJob: 'A' },
    },
    {
      id: 'E',
      name: 'Job E',
      workflowId: 'wf-one',
      adaptor: '@openfn/language-dhis2@0.3.5',
      trigger: { type: 'on_job_failure', upstreamJob: 'A' },
      enabled: true,
      operations: [
        { id: '29', label: 'fn', comment: 'Map out new records' },
        { id: '39', label: 'upsert', comment: 'Upsert results' },
      ],
    },
    {
      id: 'D',
      name: 'Job D',
      workflowId: 'wf-two',
      adaptor: '@openfn/language-http@4.0.0',
      enabled: true,
      trigger: { type: 'cron', cronExpression: '* * * * *' },
    },
    {
      id: 'F',
      name: 'Job F',
      workflowId: 'wf-three',
      adaptor: '@openfn/language-http@4.0.0',
      enabled: true,
      trigger: { type: 'cron', cronExpression: null },
    },
  ],
  workflows: [
    { name: null, id: 'wf-one' },
    { name: 'Workflow Two', id: 'wf-two' },
    { name: 'Workflow Three', id: 'wf-three' },
  ],
};

const root = createRoot(document.getElementById('root'));

function onNodeClick(_event, node) {
  console.log('Clicked Node:', node);
}

function onPaneClick(event) {
  console.log('Clicked pane:', event);
}

function Button({ children, className = {}, onClick }) {
  return (
    <div className="relative">
      <div
        onClick={onClick}
        className={cc([
          'pointer-events-auto rounded-md bg-indigo-600 py-2 px-3 text-[0.8125rem] font-semibold leading-5 text-white hover:bg-indigo-500',
          className,
        ])}
      >
        {...children}
      </div>
    </div>
  );
}

function View() {
  function onClick(e) {
    Store.addWorkspace({ name: null, id: btoa(Math.random().toString()) });
    console.log(e);
  }

  return (
    <div className="h-screen w-screen antialiased">
      <div className="flex h-full w-full flex-col">
        <div className="h-16 bg-white flex gap-3 p-3 items-center border-b shadow-sm z-10">
          <Button onClick={onClick}>Add Workflow</Button>
        </div>
        <div className="flex-auto bg-secondary-100 relative">
          <section
            id="inner_content"
            className="overflow-y-auto absolute top-0 bottom-0 left-0 right-0 bg-gray-100"
          >
            <WorkflowDiagram
              projectSpace={projectSpace}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

root.render(<View />);
