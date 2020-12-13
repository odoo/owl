# 🦉 Reactivity System 🦉

## Content

- [Overview](#overview)
- [`observe`](#observe)
- [`unobserve`](#unobserve)
- [`useState hook`](#usestate-hook)

## Overview

Owl needs to be able to react to state changes. For example, whenever the state
of a component is changed, it is very convenient if Owl can react to that change
and rerender the impacted components.

To help with that, Owl provides a small set of reactivity primitives: the `observe`
and the `unobserve` functions. Briefly, they simply allow Owl to observe any change
to a given object or array.

The `observe` function is what the `useState` hook use under the hood to be able
to perform its job!

Note that these reactivity primitives will be properly called by the `useState`,
`store` and `context` features. For the majority of
use cases, there is no need to directly call these methods.

## `observe`

blabla

## `unobserve`

Note that in some cases, if a component observe some state that is owned by some
other parent component, then it is important to unobserve this state at an
appropriate moment, otherwise this may be a memory leak.

## `useState` hook

blabla
