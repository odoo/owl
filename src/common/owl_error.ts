// Custom error class that wraps error that happen in the owl lifecycle
export class OwlError extends Error {
  cause?: any;
}
