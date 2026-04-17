# Reference

Here is a list of everything exported by the Owl library.

## Core

- [`App`](app.md): an Owl application (root components, templates, and config)
- [`Component`](component.md): base class for Owl components
- [`mount`](app.md#mount-helper): mount a component to a DOM target
- [`xml`](template_syntax.md#inline-templates): define an inline template
- [`props`](props.md): declare and validate component props
- [`status`](component.md#status-helper): get the status of a component (new, mounted, destroyed)

## Reactivity

- [`signal`](reactivity.md#signals): create a reactive value
- [`computed`](reactivity.md#computed-values): create a lazily-evaluated derived value
- [`proxy`](reactivity.md#proxy): create a reactive proxy for an object
- [`effect`](reactivity.md#effects): create a side effect that re-runs when dependencies change
- [`markRaw`](reactivity.md#markraw): mark an object so it is ignored by the reactivity system
- [`toRaw`](reactivity.md#toraw): given a proxy, return the underlying non-reactive object
- [`untrack`](reactivity.md#untrack): execute a function without tracking reactive dependencies

## Lifecycle Hooks

- [`onWillStart`](component.md#willstart): async, before first rendering
- [`onMounted`](component.md#mounted): after component is rendered and added to the DOM
- [`onWillPatch`](component.md#willpatch): before the DOM is patched
- [`onPatched`](component.md#patched): after the DOM is patched
- [`onWillUnmount`](component.md#willunmount): before removing component from DOM
- [`onWillDestroy`](component.md#willdestroy): before component is destroyed
- [`onError`](component.md#onerror): catch and handle errors

## Other Hooks

- [`useEffect`](hooks.md#useeffect): create a reactive effect, cleaned up on destroy
- [`useListener`](hooks.md#uselistener): add a listener to a target, removed on destroy
- [`useApp`](hooks.md#useapp): get the current App instance

## Plugins

- [`Plugin`](plugins.md): base class for plugins
- [`plugin`](plugins.md): import a plugin dependency
- [`providePlugins`](plugins.md): make plugins available to a component subtree

## Type Validation

- [`types`](types_validation.md#validators): built-in type validators
- [`validateType`](types_validation.md#validatetype): check a value against a type validator
- [`assertType`](types_validation.md#asserttype): like validateType, but throws on failure

## Utilities

- [`EventBus`](utils.md#eventbus): a simple event bus
- [`markup`](template_syntax.md#outputting-data): mark a string as safe HTML (not escaped by `t-out`)
- [`batched`](utils.md#batched): batch function calls into a single microtask execution
- [`whenReady`](utils.md#whenready): execute code when the DOM is ready
- [`Registry`](resources_and_registries.md#registry): ordered key-value collection with reactivity
- [`Resource`](resources_and_registries.md#resource): ordered set collection with reactivity
