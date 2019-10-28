# 🦉 Miscellaneous 🦉

## `AsyncRoot`

When this component is used, a new rendering sub tree is created, such that the
rendering of that component (and its children) is not tied to the rendering of
the rest of the interface. It can be used on an asynchronous component, to
prevent it from delaying the rendering of the whole interface, or on a
synchronous one, such that its rendering isn't delayed by other (asynchronous)
components. Note that this directive has no effect on the first rendering, but
only on subsequent ones (triggered by state or props changes).

```xml
<div t-name="ParentComponent">
  <SyncChild />
  <AsyncRoot>
     <AsyncChild/>
  </AsyncRoot>
</div>
```

The `AsyncRoot` assumes that there is exactly one root node inside it. It can
be a dom node or a component.
