# 🦉 Owl Content 🦉

Here is a complete visual representation of everything exported by the `owl`
global object.

For example, `Component` is available at `owl.Component` and `EventBus` is
exported as `owl.core.EventBus`.

```
browser
Component                               misc
Context                                     AsyncRoot
QWeb                                        Portal
mount                                   router
Store                                       Link
useState                                    RouteComponent
config                                      Router
    mode
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
    useComponent
    useEnv
    useSubEnv
    useStore
    useDispatch
    useGetters
```

Note that for convenience, the `useState` hook is also exported at the root of the `owl` object.
