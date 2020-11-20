# 🦉 Browser 🦉

## Content

- [Overview](#overview)
- [Browser Content](#browser-content)

## Overview

The browser object contains some browser native APIs, such as `setTimeout`, that
are used by Owl and its utility functions. They are exposed with the intent of
making them mockable if necessary.

```js
owl.browser.setTimeout === window.setTimeout; // return true
```

For now, this object contains some functions that are not used by Owl. They
will eventually be removed in Owl 2.0.

## Browser Content

More specifically, the `browser` object contains the following methods and objects:

- `setTimeout`
- `clearTimeout`
- `setInterval`
- `clearInterval`
- `requestAnimationFrame`
- `random`
- `Date`
- `fetch`
- `localStorage`
