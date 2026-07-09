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
export { effect } from "./effect";

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

// Type validators (`t` is the documented short alias of `types`)
export {
  types,
  types as t,
  constructorType,
  applyDefaults,
  getDefault,
  type Constructor,
  type GetDefaultedKeys,
  type GetOptionalEntries,
  type KeyedObject,
  type LiteralTypes,
  type Optional,
  type PrettifyShape,
  type ResolveObjectType,
  type ResolveOptionalEntries,
  type ResolveReaderObjectType,
  type ShapeType,
  type StripBrands,
  type Type,
  type UnionToIntersection,
  type WithDefault,
  // Phantom brand symbols carried by the public `Type`/`Optional`/`WithDefault`
  // types. Exported (type-only) so downstream projects can name them when
  // emitting declaration files, mirroring `isProps` (see owl#1958).
  type hasDefault,
  type isOptional,
  type typeBrand,
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

// Hooks
export {
  useApp,
  useEffect,
  useListener,
} from "./hooks";

export {
  onWillDestroy,
  onWillStart,
} from "./lifecycle_hooks";

export {
  config,
  usePlugin,
  plugin,
  type PluginInstance,
} from "./plugin_hooks";

export {
  EventBus,
  htmlEscape,
  Markup,
  markup,
} from "./utils";
