# Event Processor

## Purpose

The event processor is a queue-based system that transforms engine events into Lightning websocket events while guaranteeing sequential ordering and enabling batching. It bridges the multi-threaded Runtime Engine and the websocket channel to Lightning.

## Core Problem

The processor solves a fundamental mismatch:

- **Runtime Engine**: Emits events asynchronously from worker threads, potentially in rapid bursts
- **Lightning websocket**: Requires sequential transmission with acknowledgment before sending the next message
- **Solution**: Queue all events and process one at a time, with optional batching for high-frequency events

## Architecture

### Event Flow

1. **Registration**: Processor registers listeners for all engine events (workflow start/complete, job start/complete/error, logs)
2. **Enqueueing**: When engine emits event, processor immediately pushes `{name, event}` onto queue
3. **Processing**: Only first queue item processes at a time; completion triggers next item automatically
4. **Transformation**: Event handlers convert engine payloads to Lightning payloads
5. **Transmission**: `sendEvent` wraps Phoenix channel push with error handling and acknowledgment

### Sequential Guarantee

Events sent in exact order they were emitted:

- Process function awaits send operation
- Send operation awaits websocket acknowledgment
- Only after acknowledgment does queue shift and process next event
- Exception: batched events sent as atomic unit at position of first event in batch

## Batching System

### Why Batching Exists

Without batching, workflows producing hundreds of logs would create hundreds of websocket messages, each requiring round-trip acknowledgment. Severe performance penalty.

We see in production servers that this can introduce latency on log messages

### How It Works

**Opening a Batch**:

- When processing event with batching enabled, processor opens batch for that event type
- Event added to accumulating array instead of sending immediately
- **Peek-ahead optimization**: Processor scans forward in queue, pulling all subsequent matching events into batch until limit reached or queue exhausted

**Closing a Batch**:
Three conditions trigger send:

1. Batch reaches size limit (default: 10 events)
2. Different event type arrives (batch sent before processing new event)
3. Timeout expires (default: 10ms)

**Ordering with Batches**:

- If non-batchable event arrives while batch open, batch immediately closes and sends
- Maintains strict ordering: events arriving after batch must be sent after batch

### Configuration

Currently only `WORKFLOW_LOG` events batch, and only when `batchLogs` option enabled. Tunable parameters:

- `batchLimit`: Maximum events per batch (default: 10)
- `batchInterval`: Maximum time batch stays open (default: 10ms)

## Event Handler Contract

**Inputs**:

- Full context object (run ID, channel, state, logger, engine)
- Raw engine event payload

**Responsibilities**:

- Transform engine payload to Lightning payload format
- Call `sendEvent` to transmit via websocket
- Can be sync or async (processor awaits either way)

**Special Cases**:

- `run-start`: Loads version info, sends additional log events synchronously
- `run-log`: Dual-mode behavior—batches logs into array or sends individually based on config

## Error Handling

### Handler Errors

- All handler execution wrapped in try-catch
- If handler throws: catch, check if already reported to Sentry, report if not, log, continue to next event
- Failed event removed from queue, processing continues
- No retry by processor (sendEvent has own retry logic for timeouts, currently disabled)

### Websocket Errors

- `sendEvent` wraps Phoenix channel with promise
- Resolves on `ok`, rejects on `error` or `timeout`
- Errors reported to Sentry with run context
- No circuit breaker: if channel fails, each subsequent event fails individually

### Isolation

Bugs in one handler don't cascade to other events, but partial state may be visible in Lightning if critical events fail (e.g., step-start succeeds but step-complete fails).

## Integration Points

### Initialization (execute.ts)

```
eventProcessor(engine, context, {
  [WORKFLOW_START]: handleRunStart,
  [JOB_START]: handleStepStart,
  [JOB_COMPLETE]: handleStepComplete,
  [JOB_ERROR]: onJobError,
  [WORKFLOW_LOG]: handleRunLog,
  [WORKFLOW_COMPLETE]: handleRunComplete,
  [WORKFLOW_ERROR]: handleRunError,
}, {
  batch: options.batchLogs ? { [WORKFLOW_LOG]: true } : {},
  batchInterval: options.batchInterval,
  batchLimit: options.batchLimit,
})
```

Processor set up before workflow starts, ensuring no events missed.

### Websocket Layer (send-event.ts)

- Wraps Phoenix channel push with promise interface
- Handles `ok`, `error`, `timeout` responses
- Retry-on-timeout infrastructure exists but disabled (duplication concerns on Lightning side)
- Reports errors to Sentry with run context and rejection reasons

### Sentry Integration

- Adds breadcrumb for each processed event (except workflow-log to reduce noise)
- Breadcrumbs use engine event names (documenting what processor received)
- Creates trail showing event sequence leading up to errors
- Handler errors reported with run context and event name

## Performance Characteristics

**Without Batching**:

- Every event incurs full websocket round-trip cost
- High-frequency logs create bottleneck
- Queue grows during waiting periods

**With Batching**:

- Hundreds of logs/second → tens of messages
- Order of magnitude reduction in network overhead
- Peek-ahead optimization maximizes batch size even for slightly staggered events

**Bottlenecks**:

- Synchronous processing means slow handlers (e.g., loading versions) block queue
- In practice, websocket latency dominates
- No parallelization by design (ordering guarantee more important than throughput)

## Key Design Decisions

1. **Single-threaded sequential processing**: Sacrifices parallel throughput for ordering guarantees (Lightning cannot reconstruct order from timestamps due to clock skew)

2. **Peek-ahead optimization**: Aggressively accumulates queued events into batch, making batch size predictable and reducing latency

3. **Continue on error**: Single failed event doesn't halt subsequent events (robustness over consistency)

4. **Callback-based architecture**: Processor generic and testable, knows nothing about Lightning protocol, just queues/batches/invokes callbacks

5. **No explicit teardown**: Relies on engine event emitter lifecycle; queue drains naturally when workflow completes

## Critical Implementation Details

- Active batch tracked with `activeBatch` variable (event name or null)
- Batch events stored in `batch` array, cleared after send
- Batch timeout stored in `batchTimeout`, cleared when batch sends
- Queue implemented as array, items are `{name, event}` objects
- Processing triggered by `enqueue` when queue length becomes 1
- Recursive `next()` call after queue shift creates continuous flow
- Event handlers imported from events directory, mapped explicitly in execute function
