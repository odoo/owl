// Error type for framework-generated errors (invalid props, missing template,
// unknown component, bad directive, …). Errors thrown from user code are
// rethrown as-is and are NOT converted to OwlError.
export class OwlError extends Error {
  cause?: any;
}
