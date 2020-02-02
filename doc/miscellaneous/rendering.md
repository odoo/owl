# 🦉 Rendering Pipeline 🦉

We explain here how Owl is designed, from the perspective of its rendering
pipeline.

Warning: these notes are technical by nature, and intended for people working
on Owl (or interested in understanding its design).

## Overview

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
