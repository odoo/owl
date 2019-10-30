# 🦉 OWL Documentation 🦉

## Owl Content

Owl is a javascript library that contains some core classes and function to help
build applications. Here is a complete representation of its content:

```
owl
    Component
    Context
    QWeb
    Store
    useState
    core
        EventBus
        Observer
    hooks
        onWillStart
        onMounted
        onWillUpdateProps
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
    misc
        AsyncRoot
    router
        Link
        RouteComponent
        Router
    tags
        xml
    utils
        debounce
        escape
        loadJS
        loadFile
        shallowEqual
        whenReady
```

Note that for convenience, the `useState` hook is also exported at the root of the `owl` object.

## Reference

- [Animations](reference/animations.md)
- [Component](reference/component.md)
- [Context](reference/context.md)
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

## Miscellaneous

- [Comparison with React/Vue](comparison.md)
- [Tooling](tooling.md)
- [Templates to start Owl applications (external link)](https://github.com/ged-odoo/owl-templates)

## Architecture

This section explains in more detail the inner workings of Owl. It is more
useful for people working on Owl code.

- [Virtual DOM](architecture/vdom.md)
- [Rendering](architecture/rendering.md)
