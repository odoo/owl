// Errors
export { OwlError } from "./owl_error";

// Status constants
export { STATUS } from "./status";

// Utilities
export { batched } from "./batched";

// Scope / lifetime
export {
  Scope,
  scopeStack,
  getScope,
  useScope,
  isAbortError,
} from "./scope";

// Reactivity: proxy
export { proxy, markRaw, toRaw, proxifyTarget } from "./proxy";

// Reactivity: computations (core tracking primitives)
export {
  untrack,
  type ReactiveValue,
  type Atom,
  type ComputationAtom,
  ComputationState,
  atomSymbol,
  createComputation,
  onReadAtom,
  onWriteAtom,
  getCurrentComputation,
  setComputation,
  updateComputation,
  removeSources,
  disposeComputation,
} from "./computations";

// Reactivity: signal
export { signal, type Signal } from "./signal";

// Reactivity: computed
export { computed } from "./computed";

// Reactivity: effect
export { effect, immediateEffect } from "./effect";

// Reactivity: asyncComputed
export {
  asyncComputed,
  type AsyncComputed,
  type AsyncComputedContext,
  type AsyncComputedOptions,
} from "./async_computed";

// Validation
export {
  assertType,
  validateType,
  type ValidationContext,
  type ValidationIssue,
} from "./validation";

// Type validators
export {
  types,
  constructorType,
  type Constructor,
  type GetOptionalEntries,
  type KeyedObject,
  type LiteralTypes,
  type PrettifyShape,
  type ResolveObjectType,
  type ResolveOptionalEntries,
  type UnionToIntersection,
} from "./types";

// Registry / Resource
export { Registry } from "./registry";
export { Resource, type ResourceAddOptions } from "./resource";

// Plugin system
export {
  Plugin,
  PluginManager,
  startPlugins,
  type PluginConstructor,
} from "./plugin_manager";
