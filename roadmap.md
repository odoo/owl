# 🦉 OWL Roadmap 🦉

- Current version: 0.23.0
- Status: mostly stable

This roadmap is only an attempt at predicting Owl's future.  Everything may
change!

### October 2019

We plan to complete the following tasks:

- make owl asynchronous rendering rock solid (issue #330),
- improve API for root widgets (issue #306),
- replace `t-keepalive`, `t-asyncroot` and maybe `t-transition` by components (issue #295).

### November 2019

Once the previous tasks are done, release version 1.0alpha. This means that the
API should be stable.  But it could change a little bit if we need it for our
work on Odoo.

### End of 2019

Release v1.0

- API should be stable,
- we will use semantic versioning,
- we will maintain a changelog and an upgrade guide.

### 1.x

- add chrome and firefox devtools,
- add support for single file components,
- fix every bugs,
- improve documentation,
- small backward compatible improvements.

### 2.x (2021? 2022?)

Maybe:

- reimplement vdom to use *block* system, like Vue 3,
- refactor `QWeb` to use an intermediate representation (some kind of AST) to
  allow additional optimisations.


