The lexicon (aka the OpenFunctionicon) is a central repositoty of key type and word definitions.

It's a types repo and glossary at the same time.

## Overview

The OpenFunction stack is built on the concepts of Workflows, Runs, Jobs and Expressions (and more). Some of these terms can be used interchangable, or used differently in certain contexts.

Here are the key concepts

- An **Expression** is a string of Javascript (or Javascript-like code) written to be run in the CLI or Lightning.
- A **Job** is an expression plus some metadata required to run it - typically an adaptor and credentials.
  The terms Job and Expression are often used interchangeably.
- A **Workflow** is a series of steps to be executed in sequence. Steps are usually Jobs (and so job and step are often used
  interchangeably), but can be Triggers.
- An **Execution Plan** is a Workflow plus some options which inform how it should be executed (ie, start node, timeout).

The term "Execution plan" is mostly used internally and not exposed to users, and is usually interchangeable with Workflow.

You can find formal type definition of these and more in `src/core.d.ts`.

Lightning also introduces it's own terminolgy as it is standalone application and has features that the runtime itself does not.

In Lightning, a Step can be a Job or a Trigger. Jobs are connected by Paths (also known sometimes as Edges), which may be conditional.

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
