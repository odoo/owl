# 🦉 Precompiling templates 🦉

Owl is designed to be used by the Odoo javascript framework. Since Odoo handles
its assets in its own non standard way, it was decided/assumed that Owl would
compile templates at runtime.

However, in some cases, it is not optimal, or even worse, not possible to do that.
For example, browser extensions do not allow javascript code to create a new
function (using the `new Function(...)` syntax).

Therefore, in these cases, it is required to compile templates ahead of time. It
is possible to do that in Owl, but the tooling is still rough. For now, the
process is the following:

1. write your templates in xml files (with a `t-name` directive to declare the name
   of the template)
2. Compile them in a `templates.js` file
3. get the `owl.iife.runtime.js` file (which is a owl build without the compiler)
4. bundle `owl.iife.runtime.js` and `template.js` with your assets (owl needs to
   be positioned before the templates)

Here is a more detailed explanation on how to compile xml files into a js file:

1. clone the owl repository locally
2. `npm install` to install all the required tooling
3. `npm run build:runtime` to build the `owl.iife.runtime.js` file
4. `npm run build:compiler` to build the template compiler
5. `npm run compile_templates -- path/to/your/templates` will scan your target
   folder, find all xml files, get all templates, compile them, and generate a
   `templates.js` file.
