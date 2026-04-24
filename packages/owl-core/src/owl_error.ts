// Error type for framework-generated errors (invalid props, missing template,
// unknown component, bad directive, …). Errors thrown from user code are
// rethrown as-is and are NOT converted to OwlError.
//
// `cause` is inherited from the native Error (ES2022) and typed as `unknown`
// — callers should narrow before use.
export class OwlError extends Error {}
