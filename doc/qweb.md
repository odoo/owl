# 🦉 QWeb 🦉

## Content

- [Overview](#overview)
- [Base Specification](#qweb-specification)
- [OWL Specific Extensions](#owl-specific-extensions)


## Overview

[QWeb](https://www.odoo.com/documentation/12.0/reference/qweb.html) is the primary templating engine used by Odoo. It is based on the XML format, and used
mostly to generate html.

Template directives are specified as XML attributes prefixed with `t-`, for instance `t-if` for conditionals, with elements and other attributes being rendered directly.

To avoid element rendering, a placeholder element `<t>` is also available, which executes its directive but doesn’t generate any output in and of itself.

The QWeb implementation in the OWL project is slightly different.  It compiles
templates into functions that output a virtual DOM instead of a string. This is
necessary for the component system.  In addition, it has a few extra directives
(see [OWL Specific Extensions](#owlspecificextensions))

**Note on white spaces:** white spaces in a templates are handled in a special way:

- consecutive whitespaces are always condensed to a single whitespace
- if a whitespace-only text node contains a linebreak, it is ignored
- the previous rules do not apply if we are in a `<pre>` tag


## QWeb Specification

Todo

## OWL Specific Extensions

- t-on directive
- t-widget, t-props, t-key
- t-ref

