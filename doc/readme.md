# Odoo Web Library Documentation

Currently, this repository contains:

- an implementation/extension of the QWeb template engine that outputs a virtual
  dom (using the snabbdom library)
- a Component class, which uses the QWeb engine as its underlying rendering
  mechanism. The component class is designed to be declarative, with
  asynchronous rendering. Also, it uses snabbdom as the virtual dom library.
- some utility functions/classes
- a Store class and a connect function, to help manage the state of an application (like react-redux)

- [Quick Start](quick_start.md)
- [Tutorial](tutorial.md)
- [Component](component.md)
- [QWeb](qweb.md)
- [State Management](state_management.md)
