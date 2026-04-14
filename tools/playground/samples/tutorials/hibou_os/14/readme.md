## A Browser App

Time for a fun one! In this step, you will create a mini browser app with
an address bar and an iframe that displays the target URL.

Here is what you need to do:

- Create a `BrowserApp` component (`browser_app.js` + `browser_app.css`) in
  `apps/browser/`
- It should have a `url` signal initialized to `"https://en.wikipedia.org"`
- Display an input bound to the URL with `t-model` and an `<iframe>` that
  loads it
- Register it in the `menuItemRegistry` with icon `🌐` and name "Browser",
  and specify `width: 800, height: 600`
- Add optional `width` and `height` fields to the `menuItemRegistry`
  validation schema
- Update the `WindowManagerPlugin.open()` method to accept and store
  `width`/`height`
- Update the `Window` component to apply `width`/`height` on the root
  element when provided
- Update the `WindowManager` template to pass `width`/`height` through
- Import the app in `main.js`

### Hints

The component is straightforward:

```js
import { Component, xml, signal } from "@odoo/owl";

export class BrowserApp extends Component {
    static template = xml`
      <div class="browser-app">
        <input class="browser-url" t-model="this.url"/>
        <iframe t-att-src="this.url()"/>
      </div>`;

    url = signal("https://en.wikipedia.org");
}
```

Note that some websites block being embedded in iframes (via
`X-Frame-Options` or CSP headers). If Google does not load, try another URL
like `https://en.wikipedia.org`.

## Bonus Exercises

- Add a "Go" button that navigates to the URL only when clicked (instead of
  updating on every keystroke).
- Add back/forward navigation with a history array.
