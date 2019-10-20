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

- [Animations](animations.md)
- [Component](component.md)
- [Context](context.md)
- [Event Bus](event_bus.md)
- [Hooks](hooks.md)
- [Observer](observer.md)
- [QWeb](qweb.md)
- [Router](router.md)
- [Store](store.md)
- [Tags](tags.md)
- [Utils](utils.md)
- [Virtual DOM](vdom.md)

## Learning Resources

- [Quick Start](quick_start.md)

## Miscellaneous

- [Comparison with React/Vue](comparison.md)
- [Tooling](tooling.md)
- [Templates to start Owl applications (external link)](https://github.com/ged-odoo/owl-templates)
