# Notable  changes

from owl 1.x to owl 2.x

- Component is no longer an event bus
- lifecycle methods are only accessed with hooks
- a component cannot longer be mounted on a detached dom element
- components cannot be unmounted/remounted
- portal:
    - allow arbitrary content
    - does not transfer events
- t-component is now only used for an expression evaluating to a component class
  (no longer a string)