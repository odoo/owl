# 🦉 Quick Start 🦉

## Static Server

Let us assume that we have a static server running somewhere. We could then
simply add an html page with a few extra files.

### HTML and CSS

In a file `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My OWL App</title>
    <link href="app.css" rel="stylesheet" />
    <script src="owl-X.Y.Z.js"></script>
  </head>
  <body>
    <div id="main"></div>
    <script src="app.js" type="module"></script>
  </body>
</html>
```

In `app.css`:

```css
button {
  color: darkred;
  font-size: 30px;
  width: 220px;
}
```

Also, let's not forget to add a release of OWL (`owl-X.Y.Z.js`)

### XML

In `templates.xml`:

```xml
<templates>
   <button t-name="clickcounter" t-on-click="increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>
</templates>
```

### JS

To build an application (or a sub-part of an application), we need two things:

- an environment: it is the global context in which we are working. It needs to
  contain a QWeb instance (preloaded with templates), and anything else that we
  need. In practice, it could be used to contain some user session information, some
  configuration keys (for example, isMobile = true/false if we are in mobile mode).

- a description of the user interface: there should be a root component, which can
  have sub components

Here are a few steps that we may take to get started:

- get the templates
- create a qweb engine, with the templates
- create an environment
- create an instance of the root component
- mount the root component to a DOM element

Let us now add the javascript to make it work, in `app.js`:

```javascript
const useState = owl.hooks.useState;

class ClickCounter extends owl.Component {
  static template = "clickcounter";
  state = useState({ value: 0 });

  increment() {
    this.state.value++;
  }
}

//------------------------------------------------------------------------------
// Application initialization
//------------------------------------------------------------------------------
async function start() {
  const templates = await owl.utils.loadFile("templates.xml");
  const env = {
    qweb: new owl.QWeb({ templates })
  };
  const counter = new ClickCounter(env);
  const target = document.getElementById("main");
  await counter.mount(target);
}

start();
```
