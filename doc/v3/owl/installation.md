# Installation

## npm

```bash
npm install @odoo/owl
```

## CDN (no build step)

Owl ships as a native ES module, so it can be loaded directly from any CDN that
serves npm packages. The example below uses [unpkg](https://unpkg.com/), but
[jsDelivr](https://www.jsdelivr.com/) and [esm.sh](https://esm.sh/) work too.

Use an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap)
so that bare `@odoo/owl` imports resolve to the CDN URL:

```html
<!doctype html>
<html>
  <head>
    <script type="importmap">
      {
        "imports": {
          "@odoo/owl": "https://unpkg.com/@odoo/owl/dist/owl.es.js"
        }
      }
    </script>
  </head>
  <body>
    <script type="module">
      import { Component, mount, signal, xml } from "@odoo/owl";

      class Counter extends Component {
        static template = xml`
          <button t-on-click="() => this.count.set(this.count() + 1)">
            Count: <t t-out="this.count()"/>
          </button>`;
        count = signal(0);
      }

      mount(Counter, document.body);
    </script>
  </body>
</html>
```

For production, pin to a specific version (e.g. `@odoo/owl@3.0.0`) so upgrades
don't silently break your app.
