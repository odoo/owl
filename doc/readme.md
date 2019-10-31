# 🦉 OWL Documentation 🦉

## Reference

- [Animations](reference/animations.md)
- [Component](reference/component.md)
- [Configuration](reference/config.md)
- [Context](reference/context.md)
- [Environment](reference/environment.md)
- [Event Bus](reference/event_bus.md)
- [Hooks](reference/hooks.md)
- [Misc](reference/misc.md)
- [Observer](reference/observer.md)
- [QWeb](reference/qweb.md)
- [Router](reference/router.md)
- [Store](reference/store.md)
- [Tags](reference/tags.md)
- [Utils](reference/utils.md)

## Learning Resources

- [Quick Start: create an (almost) empty Owl application](learning/quick_start.md)
- [Environment: what it is and what it should contain](learning/environment.md)

## Miscellaneous

- [Comparison with React/Vue](comparison.md)
- [Tooling](tooling.md)
- [Templates to start Owl applications (external link)](https://github.com/ged-odoo/owl-templates)

## Architecture

This section explains in more detail the inner workings of Owl. It is targeted
for developers working on Owl itself.

- [Virtual DOM](architecture/vdom.md)
- [Rendering](architecture/rendering.md)

## Owl Content

Here is a complete visual representation of everything exported by the `owl`
global object (so, for example, `Component` is available at `owl.Component`,
and `EventBus` is exported as `owl.core.EventBus`):

```
Component                               misc
Context                                     AsyncRoot
QWeb                                    router
Store                                       Link
useState                                    RouteComponent
config                                      Router
    mode                                tags
    env                                     xml
core                                    utils
    EventBus                                debounce
    Observer                                escape
hooks                                       loadJS
    onWillStart                             loadFile
    onMounted                               shallowEqual
    onWillUpdateProps                       whenReady
    onWillPatch
    onPatched
    onWillUnmount
    useContext
    useState
    useRef
    useSubEnv
    useStore
    useDispatch
    useGetters
```

Note that for convenience, the `useState` hook is also exported at the root of the `owl` object.
