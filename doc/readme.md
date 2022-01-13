# 🦉 Owl overview 🦉

Here is a list of everything exported by the Owl library:

Main entities:

- [`App`](reference/app.md): represent an Owl application (mainly a root component,a set of templates, and a config)
- [`Component`](reference/component.md): the main class to define a concrete Owl component
- [`mount`](reference/app.md#mount-helper): main entry point for most application: mount a component to a target
- [`useState`](reference/reactivity.md#usestate): create a reactive object (hook, linked to a specific component)
- [`reactive`](reference/reactivity.md#reactive): create a reactive object (not linked to any component)
- [`xml`](reference/templates.md#inline-templates): helper to define an inline template

Lifecycle hooks:

- [`onWillStart`](reference/component.md#willstart): hook to define asynchronous code that should be executed before component is rendered
- [`onMounted`](reference/component.md#mounted): hook to define code that should be executed when component is mounted
- [`onWillPatch`](reference/component.md#willpatch): hook to define code that should be executed before component is patched
- [`onWillUpdateProps`](reference/component.md#willupdateprops): hook to define code that should be executed before component is updated
- [`onPatched`](reference/component.md#patched): hook to define code that should be executed when component is patched
- [`onWillRender`](reference/component.md#willrender): hook to define code that should be executed before component is rendered
- [`onRendered`](reference/component.md#rendered): hook to define code that should be executed after component is rendered
- [`onWillUnmount`](reference/component.md#willunmount): hook to define code that should be executed before component is unmounted
- [`onWillDestroy`](reference/component.md#willdestroy): hook to define code that should be executed before component is destroyed
- [`onError`](reference/component.md#onerror): hook to define a Owl error handler

Other hooks:

- [`useComponent`](reference/hooks.md#usecomponent): return a reference to the current component (useful to create derived hooks)
- [`useEffect`](reference/hooks.md#useeffect): define an effect with its dependencies
- [`useEnv`](reference/hooks.md#useenv): return a reference to the current env
- [`useExternalListener`](reference/hooks.md#useexternallistener): add a listener outside of a component DOM
- [`useRef`](reference/hooks.md#useref): get an object representing a reference (`t-ref`)
- [`useSubEnv`](reference/hooks.md#usesubenv): extend the current env with additional information for child components

Utility/helpers:

- [`EventBus`](reference/utils.md#eventbus): a simple event bus
- [`loadFile`](reference/utils.md#loadfile): an helper to load a file from the server
- [`markup`](reference/templates.md#outputting-data): utility function to define strings that represent html (should not be escaped)
- [`status`](reference/component.md#status-helper): utility function to get the status of a component (new, mounted or destroyed)
- [`whenReady`](reference/utils.md#whenready): utility function to execute code when DOM is ready
