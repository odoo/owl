# 🦉 Owl Content 🦉

Here is a complete visual representation of everything exported by the `owl`
global object.

For example, `Component` is available at `owl.Component` and `EventBus` is
exported as `owl.core.EventBus`.

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
    observe                             utils
    unobserve                               debounce
hooks                                       escape
    onWillStart                             loadJS
    onMounted                               loadFile
    onWillUpdateProps                       shallowEqual
    onWillPatch                             whenReady
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
