# Odoo Web Lab Documentation

Currently, this repository contains:

1. **core**

   - an implementation/extension of the QWeb template engine that outputs a virtual
     dom (using the snabbdom library)
   - a Component class, which uses the QWeb engine as its underlying rendering
     mechanism. The component class is designed to be declarative, with
     asynchronous rendering. Also, it uses snabbdom as the virtual dom library.
   - some utility functions/classes

2. **extras**
   - a Store class and a connect function, to help manage the state of an application (like react-redux)
   - a Registry: this is a simple key/store mapping

- [Quick Start](quick_start.md)
- [Tutorial](tutorial.md)
- [Component](component.md)
- [QWeb](qweb.md)
- [State Management](state_management.md)
