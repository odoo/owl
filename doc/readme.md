# 🦉 OWL Documentation 🦉

## Reference

- [Animations](reference/animations.md)
- [Component](reference/component.md)
- [Concurrency Model](reference/concurrency_model.md)
- [Configuration](reference/config.md)
- [Context](reference/context.md)
- [Environment](reference/environment.md)
- [Event Bus](reference/event_bus.md)
- [Hooks](reference/hooks.md)
- [Miscellaneous Components](reference/misc.md)
- [Observer](reference/observer.md)
- [Props](reference/props.md)
- [Props Validation](reference/props_validation.md)
- [QWeb Templating Language](reference/qweb_templating_language.md)
- [QWeb Engine](reference/qweb_engine.md)
- [Router](reference/router.md)
- [Store](reference/store.md)
- [Tags](reference/tags.md)
- [Utils](reference/utils.md)

## Learning Resources

- [Quick Start: create an (almost) empty Owl application](learning/quick_start.md)
- [Tutorial: create a TodoList application](learning/tutorial_todoapp.md)
- [Testing Owl components](learning/testing_components.md)

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
QWeb                                        Portal
Store                                   router
useState                                    Link
config                                      RouteComponent
    mode                                    Router
core                                    tags
    EventBus                                css
    Observer                                xml
hooks                                   utils
    onWillStart                             debounce
    onMounted                               escape
    onWillUpdateProps                       loadJS
    onWillPatch                             loadFile
    onPatched                               shallowEqual
    onWillUnmount                           whenReady
    useContext
    useState
    useRef
    useSubEnv
    useStore
    useDispatch
    useGetters
```

Note that for convenience, the `useState` hook is also exported at the root of the `owl` object.
