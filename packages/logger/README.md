## Levels

Log policies in the CLI and sub components

The log enables the following levels:

* success (default) - prints high level stuff that worked
  - files loaded
  - files written to
* info - Notification of major things that happened
  - compiler changes
* Debug - traces when entering (and exiting?) particular functions. Prints details objects and source.

I don't really know if sucess is a level. I think that's info.

By default the CLI logs jobs at trace and everything else at success



ok, so compiler info will report high level on what each transform did. compiler trace will report on each statement it modifies.

A good rule of thumb is that trace will log supporting information for an info.


I just have this really strong sense there's something inbetween info and debug.

* default - no detail
* info - 


ah ok, maybe it's like this:

* default (error and major success - just what you NEED to know)
* info - a bit of detail abotu what's happening under the hood, interesting to most users
* debug - deep tracing, including data dumps

So info is the middle layer I'm lookign for.

success - a critical high level opeation succeeded
info - interesting explanation abotu whats happening
debug - detailed stack tracing

This can be calibrated per component

--log defaultLevel component=level