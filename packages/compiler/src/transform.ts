/**
 * Transform an AST into a job compatible with the open fn run time
 * - Move leading top level code into a fn() job
 * - Move top-level code
 * - Ignore any other top-level code
 * 
 */