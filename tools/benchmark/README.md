# List benchmark

Measures common list operations on a table of 1000 keyed rows, in headless
Chrome, for one or more Owl builds:

```sh
npm run build
node tools/benchmark/run.mjs master-no-vdom=packages/owl/dist/owl.iife.js
```

Several builds can be compared in one run. For instance, against the published
3.0.0-beta.1:

```sh
mkdir /tmp/owl-beta && cd /tmp/owl-beta && npm pack @odoo/owl@3.0.0-beta.1 && tar -xzf odoo-owl-*.tgz && cd -
node tools/benchmark/run.mjs \
  3.0.0-beta.1=/tmp/owl-beta/package/dist/owl.iife.js \
  master-no-vdom=packages/owl/dist/owl.iife.js
```

`run.mjs` needs Node 22 (it drives Chrome through the DevTools protocol with
`fetch` and `WebSocket`, without dependencies). Set `CHROME` to use another
browser binary than `google-chrome`.

## What is measured

`list.html` mounts a component rendering the rows (`t-foreach` with `t-key`, a
class computed from a selected signal, two `t-out` and a click handler per
row), then runs each operation 5 times as a warmup and 15 times measured, and
reports the median. An operation is timed from the state change to the moment
the dom reflects it.

A vdom build commits its renderings on animation frames: the benchmark makes it
commit in a microtask instead, so that the comparison is about the work done,
not the time spent waiting for a frame.

## Results

2026-11-26, headless Chrome 158, Linux, median ms (the numbers vary by about
20% between runs):

| operation (median ms) | 3.0.0-beta.1 | master-no-vdom |
| --------------------- | ------------ | -------------- |
| create 1000 rows      | 5.7          | 8              |
| replace all rows      | 6.8          | 10.4           |
| update every 10th row | 1.5          | 0.3            |
| select row            | 1.2          | 0.8            |
| swap rows             | 1.1          | 1.8            |
| remove row            | 1.5          | 1.3            |
| clear rows            | 0.8          | 1.9            |

Updating rows is faster without the vdom: only the render effects reading what
changed run, instead of the whole component and a diff of its rows. Creating
and disposing rows costs more: each row has an owner, signals for its loop
variables, and render effects (one per block, and one per `t-out`).
