# 🦉 API Reference 🦉

Here is a list of everything exported by the Owl library.

## Core

- [`App`](reference/app.md): an Owl application (root components, templates, and config)
- [`Component`](reference/component.md): base class for Owl components
- [`mount`](reference/app.md#mount-helper): mount a component to a DOM target
- [`xml`](reference/template_syntax.md#inline-templates): define an inline template
- [`props`](reference/props.md): declare and validate component props
- [`status`](reference/component.md#status-helper): get the status of a component (new, mounted, destroyed)

## Reactivity

- [`signal`](reference/reactivity.md#signals): create a reactive value
- [`computed`](reference/reactivity.md#computed-values): create a lazily-evaluated derived value
- [`proxy`](reference/reactivity.md#proxy): create a reactive proxy for an object
- [`effect`](reference/reactivity.md#effects): create a side effect that re-runs when dependencies change
- [`markRaw`](reference/reactivity.md#markraw): mark an object so it is ignored by the reactivity system
- [`toRaw`](reference/reactivity.md#toraw): given a proxy, return the underlying non-reactive object
- [`untrack`](reference/reactivity.md#untrack): execute a function without tracking reactive dependencies

## Lifecycle Hooks

- [`onWillStart`](reference/component.md#willstart): async, before first rendering
- [`onMounted`](reference/component.md#mounted): after component is rendered and added to the DOM
- [`onWillPatch`](reference/component.md#willpatch): before the DOM is patched
- [`onPatched`](reference/component.md#patched): after the DOM is patched
- [`onWillUnmount`](reference/component.md#willunmount): before removing component from DOM
- [`onWillDestroy`](reference/component.md#willdestroy): before component is destroyed
- [`onError`](reference/component.md#onerror): catch and handle errors

## Other Hooks

- [`useEffect`](reference/hooks.md#useeffect): create a reactive effect, cleaned up on destroy
- [`useListener`](reference/hooks.md#uselistener): add a listener to a target, removed on destroy
- [`useApp`](reference/hooks.md#useapp): get the current App instance

## Plugins

- [`Plugin`](reference/plugins.md): base class for plugins
- [`plugin`](reference/plugins.md): import a plugin dependency
- [`providePlugins`](reference/plugins.md): make plugins available to a component subtree

## Type Validation

- [`types`](reference/types_validation.md#validators): built-in type validators
- [`validateType`](reference/types_validation.md#validatetype): check a value against a type validator
- [`assertType`](reference/types_validation.md#asserttype): like validateType, but throws on failure

## Utilities

- [`EventBus`](reference/utils.md#eventbus): a simple event bus
- [`markup`](reference/template_syntax.md#outputting-data): mark a string as safe HTML (not escaped by `t-out`)
- [`batched`](reference/utils.md#batched): batch function calls into a single microtask execution
- [`whenReady`](reference/utils.md#whenready): execute code when the DOM is ready
- [`Registry`](reference/resources_and_registries.md#registry): ordered key-value collection with reactivity
- [`Resource`](reference/resources_and_registries.md#resource): ordered set collection with reactivity
