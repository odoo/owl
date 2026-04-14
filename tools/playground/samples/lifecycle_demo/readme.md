# Component Lifecycle

OWL components have a lifecycle with several phases. Each phase has a corresponding hook that lets you run code at specific moments.

### setup()

Called when a component instance is created, before any other lifecycle hook. This is where we can initialize the component or register other lifecycle hooks. Note that it replaces the javascript standard constructor method.

```js
setup() {
    this.count = signal(0);
    onMounted(() => { /* ... */ });
}
```


### onWillStart

Called before the component is first rendered. Use for:

- Fetching initial data
- Async initialization

```js
onWillStart(async () => {
  this.data = await fetchData();
});
```

### onMounted

Called after the component is inserted into the DOM. Typically
used for DOM manipulation.

```js
onMounted(() => {
  const el = this.calendar();
  this.setupCalendar(el);
});
```

### onWillPatch

Called before the DOM is updated due to a state change. Use for:

- Reading DOM state before it changes
- Preparing for updates

A typical usecase is to check the scroll position in a chat window, and restore
it if necessary, after being patched.

```js
onWillPatch(() => {
  this.oldScrollTop = this.element.scrollTop;
});
```

Note that `onWillPatch` is not called when the component is mounted.

### onPatched

Called after the DOM is updated due to a state change. Use for:

- DOM manipulation after updates
- Restoring scroll position
- Third-party library integration

```js
onPatched(() => {
  this.element.scrollTop = this.oldScrollTop;
});
```

### onWillUnmount

Called before the component is removed from the DOM. Use for cleanup for side
effects that were created while the component was mounted. If the component is
destroyed before being mounted, then onWillUnmount will not be called.


```js
onWillUnmount(() => {
  clearInterval(this.timer);
});
```

### onWillDestroy

Called when the component is about to be destroyed, even if never mounted. Use for:

- Cleanup that should run regardless of mount state
- Releasing resources

```js
onWillDestroy(() => {
  this.subscription.unsubscribe();
});
```
