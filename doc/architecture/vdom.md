# 🦉 VDom 🦉

Owl is a declarative component system: we declare the structure of the component
tree, and Owl will translate that to a list of imperative operations. This
translation is done by a virtual dom. This is the low level layer of Owl, most
developer will not need to call directly the virtual dom functions.

The main idea behind a virtual dom is to keep a in-memory representation of the
DOM (called a virtual node), and whenever some change is needed, to regenerate
a new representation, compute the difference between the old and the new, then
apply the changes.

`vdom` exports two functions:

- `h`: create a new virtual node
- `patch`: compare two virtual nodes, and apply the difference.

Note: Owl's virtual dom is a fork of [snabbdom](https://github.com/snabbdom/snabbdom).
