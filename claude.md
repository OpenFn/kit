# OpenFn Kit

This monorepo contains the core packages that power OpenFn's workflow automation platform. OpenFn is a Digital Public Good trusted by NGOs and governments in 40+ countries to automate data integration workflows.

## Architecture

The repository has three main packages: **CLI**, **Runtime**, and **Worker**. The CLI and Worker are both frontends for executing workflows - the CLI for local development, the Worker for production execution via Lightning (the web platform). Both wrap the Runtime as their execution engine. The Worker uses engine-multi to wrap the Runtime for multi-process execution.

## Core Packages

- **[@openfn/cli](packages/cli)** - Command-line interface for local development. Run, test, compile, and deploy workflows.
- **[@openfn/runtime](packages/runtime)** - Core execution engine. Safely executes jobs in a sandboxed VM environment.
- **[@openfn/ws-worker](packages/ws-worker)** - WebSocket worker connecting Lightning to the Runtime. Stateless server that pulls runs from Lightning's queue. See [.claude/event-processor.md](.claude/event-processor.md) for event processing details.
- **[@openfn/engine-multi](packages/engine-multi)** - Multi-process runtime wrapper used by ws-worker for concurrent workflow execution.
- **[@openfn/compiler](packages/compiler)** - Transforms OpenFn job DSL into executable JavaScript modules.

## Supporting Packages

- **@openfn/lexicon** - Shared TypeScript types
- **@openfn/logger** - Structured logging utilities
- **@openfn/describe-package** - TypeScript analysis for adaptor docs (to be phased out)
- **@openfn/deploy** - Deployment logic for Lightning (soon to be deprecated)
- **@openfn/project** - Models and understands local OpenFn projects
- **@openfn/lightning-mock** - Mock Lightning server for testing

## AI Assistant

- Keep responses terse and do not over-explain. Users will ask for more guidance if they need it.
- Always present users a short action plan and ask for confirmation before doing it
- Keep the human in the loop at all times. Stop regularly and check for guidance.

## Key Concepts

**Workflows** are sequences of **jobs** that process data through steps. Each **job** is an array of **operations** (functions that transform state). State flows between jobs based on conditional edges.

**Adaptors** are npm packages (e.g., `@openfn/language-http`) providing operations for specific systems. The CLI auto-installs them as needed.

The **Compiler** transforms job DSL code into standard ES modules with imports and operation arrays.

## Development Setup

### Prerequisites

- Node.js 18+ (use `asdf`)
- pnpm (enable with `corepack enable`)

### Common Commands

```bash
# Root
pnpm install             # Install dependencies
pnpm build              # Build all packages
pnpm test               # Run all tests
pnpm changeset          # Add a changeset for your PR

# CLI
cd packages/cli
pnpm openfn test        # Run from source
pnpm install:global     # Install as 'openfnx' for testing

# Worker
cd packages/ws-worker
pnpm start              # Connect to localhost:4000
pnpm start -l mock      # Use mock Lightning
pnpm start --no-loop    # Disable auto-fetch
curl -X POST http://localhost:2222/claim  # Manual claim
```

### Environment Variables

- `OPENFN_REPO_DIR` - CLI adaptor storage
- `OPENFN_ADAPTORS_REPO` - Local adaptors monorepo path
- `OPENFN_API_KEY` - API key for Lightning deployment
- `OPENFN_ENDPOINT` - Lightning URL (default: app.openfn.org)
- `WORKER_SECRET` - Worker authentication secret

## Repository Structure

```
packages/
├── cli/          # CLI entry: cli.ts, commands.ts, projects/, options.ts
├── runtime/      # Runtime entry: index.ts, runtime.ts, util/linker
├── ws-worker/    # Worker entry: start.ts, server.ts, api/, events/
├── compiler/     # Job DSL compiler
├── engine-multi/ # Multi-process wrapper
├── lexicon/      # Shared TypeScript types
└── logger/       # Logging utilities
```

## Testing & Releases

```bash
pnpm test                  # All tests
pnpm test:types           # Type checking
pnpm test:integration     # Integration tests
cd packages/cli && pnpm test:watch  # Watch mode
```

## Testing Best Practice

- Ensure tests are valuable before generating them. Focus on what's important.
- Treat tests as documentation: they should show how the function is expected to work
- Keep tests focuses: test one thing in each test
- This repo contains extensive testing: check for similar patterns in the same package before improvising

## Additional Documentation

**Changesets**: Run `pnpm changeset` when submitting PRs. Releases publish automatically to npm on merge to main.

The [.claude](.claude) folder contains detailed guides:

- **[command-refactor.md](.claude/command-refactor.md)** - Refactoring CLI commands into project subcommand structure
- **[event-processor.md](.claude/event-processor.md)** - Worker event processing architecture (batching, ordering)

## Code Standards

- **Formatting**: Use Prettier (`pnpm format`)
- **TypeScript**: Required for all new code
- **TypeSync**: Run `pnpm typesync` after modifying dependencies
- **Tests**: Write tests and run `pnpm build` before testing (tests run against `dist/`)
- **Independence**: Keep packages loosely coupled where possible

## Architecture Principles

- **Separation of Concerns**: CLI and Worker are frontends; Runtime is the shared execution backend
- **Sandboxing**: Runtime uses Node's VM module for isolation
- **State Immutability**: State cannot be mutated between jobs
- **Portability**: Compiled jobs are standard ES modules
- **Zero Persistence (Worker)**: Worker is stateless; Lightning handles persistence
- **Multi-Process Isolation**: Worker uses engine-multi for concurrent workflow execution

## Contributing

1. Make changes
2. Run `pnpm test`
3. Add changeset: `pnpm changeset`
4. Open PR at https://github.com/openfn/kit

**Resources**: [docs.openfn.org](https://docs.openfn.org) | [app.openfn.org](https://app.openfn.org) | [github.com/openfn/kit](https://github.com/openfn/kit)
