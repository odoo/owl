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
mount
useState                                tags
config                                      css
    mode                                    xml
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
    useComponent
    useEnv
    useSubEnv
```

Note that for convenience, the `useState` hook is also exported at the root of the `owl` object.
