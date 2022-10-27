## @openfn/logger

A logging service which can be configured and shared to easily run with other @openfn packages.

The fundamental idea of the logger is to print namespaced output to the console, with powerful filtering controls. This allows different components to log within a single command, possibly using fine-grained output options.

## Features

- Supports the standard console API (well, not yet)
- Filtered output in the terminal
- Pluggable emitter layer
- Mock logger is great for unit tests

## Levels

The logger is build around 4 filter levels.

Packages in kit should log as much as they possibly can using the following guidelines:

default - Defaults for all the family. Prints what the user absolutely has to know. Includes notification of high level process completions. Also shows errors and warnings.
info    - For power users. Shows everything default plus generally interesting high-level information about what's happening internally.
debug   - For devs debugging - really detailed output about stepping into and out of major operations. Includes data dumps.
none    - don't show any log output

## Usage

Import and create a logger:

```
import createLogger from '@openfn/logger'
const logger = createLogger();
```

You can pass in a name and filter log levels:

```
createLogger("my logger", { level: 'debug' });
```

Then just call the logger with whatever you like!

```
logger.log('abc');
```

You can log to the following levels:

❯ debug
ℹ info
✔ success
⚠ warn
✘ error

For more options see src/options.ts.

## Mock logger

In unit testing it's helpful to track log output.

Pass the mock logger where Logger is accepted. It won't print anything to stdout, but will expose `_last`, `_history` and `_parse()` on the logger object.

`_last` returns the last logger output, as an array of the form [level, namespace, icon, message...] (as applicable).

`_hisory` returns an array of all `_last` messages (oldest at index 0)

`_parse` will intelligently parse a `_last` message and return an object with named properties. This takes into account the log options so you don't have to work out what's what.

```
const { level, icon, namespace, message } = logger._parse(logger._last);
```
