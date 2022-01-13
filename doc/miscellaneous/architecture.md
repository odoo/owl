# 🦉 Notes On Owl Architecture 🦉

We explain here how Owl is designed

Warning: these notes are technical by nature, and intended for people working
on Owl (or interested in understanding its design).

## Overview

Roughly speaking, Owl has 5 main parts:

- a virtual dom system (in `src/blockdom`)
- a component system (in `src/component`)
- a template compiler (located in the `src/compiler` folder)
- a small runtime code to tie them together (in `src/app`)
- a reactivity system (in `src/reactivity.ts`)

There are some other files, but the core of Owl can be understood with these
five main parts.

The virtual dom is an optimized virtual dom based on blocks, which supports
multi blocks (for fragments). Everything that owl renders is internally
represented by a virtual node. The job of the virtual dom is to efficiently
represent the current state of the application, and to build an actual DOM
representation when needed, or update the DOM whenever it is needed.

- some other helpers/smaller scale stuff
  A rendering occurs in two phases:

- virtual rendering: this generates the virtual dom in memory, asynchronously
- patch: applies a virtual tree to the screen (synchronously)

There are several classes involved in a rendering:

- components
- a scheduler
- fibers: small objects containing some metadata, associated with a rendering of
  a specific component

Components are organized in a dynamic component tree, visible in the user
interface. Whenever a rendering is initiated in a component `C`:

- a fiber is created on `C` with the rendering props information
- the virtual rendering phase starts on C (will asynchronously render all the
  child components)
- the fiber is added to the scheduler, which will poll continuously, every
  animation frame, if the fiber is done
- once it is done, the scheduler will call the task callback, which will apply
  the patch (if it was not cancelled in the meantime).

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
