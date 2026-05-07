// Public exports.

export { Router, type NavOptions, type RouterOptions } from "./router";

export {
  type RouterCodec,
  type CodecMiddleware,
  composeCodec,
  hiddenKeys,
  lockedKeys,
  getLockedKeys,
} from "./codec";

export {
  type HistoryAdapter,
  type MemoryHistoryOptions,
  BrowserHistoryAdapter,
  MemoryHistoryAdapter,
} from "./history";

export { RouterPlugin } from "./plugin";
export { useRouter, useLinkInterceptor, type LinkInterceptorOptions } from "./hooks";

export { createMatcher, type MatchedRoute, type MatcherOptions } from "./matcher";

export { Link, RouteSwitch } from "./components";
