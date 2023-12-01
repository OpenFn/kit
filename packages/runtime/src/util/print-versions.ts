// this fella will print versions from whatever is loaded into memory
// This should represent the start of a "run"

// this is closely related to the cli's print version script!

/*
 * node version
 * runtime version
 * compiler version+ (this is a bit wierd but will make more sense when compiler moves to JIT)
 * engine version?+
 * worker version?+
 * adaptor version+ - this is the hard one
 *
 *
 *
 * but wait!! the runtime doesn't know any of this stuff.
 *
 * so, ok, maybe what we need to do is, on run start, generate in the WORKER a sort of fake/novel log
 */
