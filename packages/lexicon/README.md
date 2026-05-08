The lexicon is a central repository of key type and word definitions. It's a types repo and glossary at the same time.

The most important part of it is the Portability Spec: which describes the portable Project and Workflow interfaces which are common not just to this repo, but to the whole OpenFn platform and toolchain.

## Overview

The OpenFunction stack is built on the concepts of Workflows, Runs, Jobs and Expressions (and more). Some of these terms can be used interchangable, or used differently in certain contexts.

Here are the key concepts:

- An **Expression** is a string of Javascript (or Javascript-like code) written to be run in the CLI or Lightning.
- A **Step** is an expression plus some metadata required to run it - typically an adaptor and credentials. Also known as a Job.
- A **Workflow** is a series of steps to be executed in sequence
- An **Execution Plan** is a Workflow plus some options which inform how it should be executed (ie, start node, timeout).

The term "Execution plan" is mostly used internally and not exposed to users, and is usually interchangeable with Workflow.

You can find formal type definition of these and more in `src/core.d.ts`.

Lightning also introduces its own terminology for platform-specific features not share by the runtime.

In Lightning, a Step can be a Job or a Trigger. Jobs are connected by Edges , which may be conditional.

You can find lightning-specific typings in `src/lightning.d.ts`

## Usage

This repo only contains type definitions. It is unlikely to be of use outside the repo - although users are free to import and use it.

To use the core types, simply import what you need:

```
import { ExecutionPlan } from '@openfn/lexicon
```

To use the lightning types, use `@openfn/lexicon/lightning`

```
import { Run } from '@openfn/lexicon/lightning
```
