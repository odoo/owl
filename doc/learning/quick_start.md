# 🦉 How to start an Owl project 🦉

## Content

- [Overview](#overview)
- [Simple html file](#simple-html-file)
- [With a static server](#with-a-static-server)
- [Standard Javascript project](#standard-javascript-project)

## Overview

Each software project has its specific needs. Many of these needs can be solved
with some tooling: `webpack`, `gulp`, css preprocessor, bundlers, transpilers, ...

Because of that, it is usually not simple to just start a project. Some
frameworks provide their own tooling to help with that. But then, you have to
integrate and learn how these applications work.

Owl is designed to be used with no tooling at all. Because of that, Owl can
"easily" be integrated in a modern build toolchain. In this section, we will
discuss a few different setups to start a project. Each of these setups has
advantages and disadvantages in different situations.

## Simple html file

The simplest possible setup is the following: a simple javascript file with your
code. To do that, let us create the following file structure:

```
hello_owl/
  index.html
  owl.js
  app.js
```

The file `owl.js` can be downloaded from the last release published at
[https://github.com/odoo/owl/releases](https://github.com/odoo/owl/releases). It
is a single javascript file which export all Owl into the global `owl` object.

Now, `index.html` should contain the following:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Hello Owl</title>
    <script src="owl.js"></script>
    <script src="app.js"></script>
  </head>
  <body></body>
</html>
```

And `app.js` should look like this:

```js
const { Component } = owl;
const { xml } = owl.tags;
const { whenReady } = owl.utils;

// Owl Components
class App extends Component {
  static template = xml`<div>Hello Owl</div>`;
}

// Setup code
function setup() {
  const app = new App();
  app.mount(document.body);
}

whenReady(setup);
```

Now, simply loading this html file in a browser should display a welcome message.
This setup is not fancy, but it is extremely simple. There are no tooling at
all required. It can be slightly optimized by using the minified build of Owl.

## With a static server

The previous setup has a big disadvantage: the application code is located in a
single file. Obviously, we could split it in several files and add multiple
`<script>` tags in the html page, but then we need to make sure the script are
inserted in the proper order, we need to export each file content in global
variables and we lose autocompletion across files.

There is a low tech solution to this issue: using native javascript modules.
This however has a requirement: for security reasons, browsers will not accept
modules on content served through the `file` protocol. This means that we need
to use a static server.

Let us start a new project with the following file structure:

```
hello_owl/
  src/
    app.js
    index.html
    main.js
    owl.js
```

As previously, the file `owl.js` can be downloaded from the last release published at
[https://github.com/odoo/owl/releases](https://github.com/odoo/owl/releases).

Now, `index.html` should contain the following:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Hello Owl</title>
    <script src="owl.js"></script>
    <script src="main.js" type="module"></script>
  </head>
  <body></body>
</html>
```

Not that the `main.js` script tag has the `type="module"` attribute. This means
that the browser will parse the script as a module, and load all its dependencies.

Here is the content of `app.js` and `main.js`:

```js
// app.js ----------------------------------------------------------------------
const { Component } = owl;
const { xml } = owl.tags;

export class App extends Component {
  static template = xml`<div>Hello Owl</div>`;
}

// main.js ---------------------------------------------------------------------
import { App } from "./app.js";

function setup() {
  const app = new App();
  app.mount(document.body);
}

owl.utils.whenReady(setup);
```

The `main.js` file import the `app.js` file. Note that the import statement has
a `.js` suffix, which is important. Most text editor can understand this syntax
and will provide autocompletion.

Now, to execute this code, we need to serve the `src` folder statically. A low
tech way to do that is to use for example the python `SimpleHTTPServer` feature:

```
$ cd src
$ python -m SimpleHTTPServer 8022    # now content is available at localhost:8022
```

Another more "javascripty" way to do it is to create a `npm` application. To do
that, we can add the following `package.json` file at the root of the project:

```json
{
  "name": "hello_owl",
  "version": "0.1.0",
  "description": "Starting Owl app",
  "main": "src/index.html",
  "scripts": {
    "serve": "serve src"
  },
  "author": "John",
  "license": "ISC",
  "devDependencies": {
    "serve": "^11.3.0"
  }
}
```

We can now install the `serve` tool with the command `npm install`, and then,
start a static server with the simple `npm run serve` command.

## Standard Javascript project

The previous setup works, and is certainly good for some usecases, including
quick prototyping. However, it lacks some useful features, such as livereload,
a test suite, or bundling the code in a single file.

Each of these features, and many others, can be done in many different ways.
Since it is really not trivial to configure such a project, we provide here an
example that can be used as a starting point.

Our standard Owl project has the following file structure:

```
hello_owl/
  public/
    index.html
  src/
    components/
      App.js
    main.js
  tests/
    components/
      App.test.js
    helpers.js
  .gitignore
  package.json
  webpack.config.js
```

This project as a `public` folder, meant to contain all static assets, such as
images and styles. The `src` folder has the javascript source code, and finally,
`tests` contains the test suite.

Here is the content of `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Hello Owl</title>
  </head>
  <body></body>
</html>
```

Note that there are no `<script>` tag here. They will be injected by webpack.
Now, let's have a look at the javascript files:

```js
// src/components/App.js -------------------------------------------------------
import { Component, tags, useState } from "@odoo/owl";

const { xml } = tags;

export class App extends Component {
  static template = xml`<div t-on-click="update">Hello <t t-esc="state.text"/></div>`;
  state = useState({ text: "Owl" });
  update() {
    this.state.text = this.state.text === "Owl" ? "World" : "Owl";
  }
}

// src/main.js -----------------------------------------------------------------
import { utils } from "@odoo/owl";
import { App } from "./components/App";

function setup() {
  const app = new App();
  app.mount(document.body);
}

utils.whenReady(setup);

// tests/components/App.test.js ------------------------------------------------
import { App } from "../../src/components/App";
import { makeTestFixture, nextTick, click } from "../helpers";

let fixture;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

describe("App", () => {
  test("Works as expected...", async () => {
    const app = new App();
    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>Hello Owl</div>");

    click(fixture, "div");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>Hello World</div>");
  });
});

// tests/helpers.js ------------------------------------------------------------
import { Component } from "@odoo/owl";
import "regenerator-runtime/runtime";

export async function nextTick() {
  return new Promise(function(resolve) {
    setTimeout(() => Component.scheduler.requestAnimationFrame(() => resolve()));
  });
}

export function makeTestFixture() {
  let fixture = document.createElement("div");
  document.body.appendChild(fixture);
  return fixture;
}

export function click(elem, selector) {
  elem.querySelector(selector).dispatchEvent(new Event("click"));
}
```

Finally, here is the configuration files `.gitignore`, `package.json` and
`webpack.config.js`:

```
node_modules/
package-lock.json
dist/
```

```json
{
  "name": "hello_owl",
  "version": "0.1.0",
  "description": "Demo app",
  "main": "src/index.html",
  "scripts": {
    "test": "jest",
    "build": "webpack --mode production",
    "dev": "webpack-dev-server --mode development"
  },
  "author": "Someone",
  "license": "ISC",
  "devDependencies": {
    "@babel/core": "^7.8.4",
    "@babel/plugin-proposal-class-properties": "^7.8.3",
    "babel-jest": "^25.1.0",
    "babel-loader": "^8.0.6",
    "babel-plugin-transform-es2015-modules-commonjs": "^6.26.2",
    "html-webpack-plugin": "^3.2.0",
    "jest": "^25.1.0",
    "regenerator-runtime": "^0.13.3",
    "serve": "^11.3.0",
    "webpack": "^4.41.5",
    "webpack-cli": "^3.3.10",
    "webpack-dev-server": "^3.10.2"
  },
  "dependencies": {
    "@odoo/owl": "^1.0.4"
  },
  "babel": {
    "plugins": ["@babel/plugin-proposal-class-properties"],
    "env": {
      "test": {
        "plugins": ["transform-es2015-modules-commonjs"]
      }
    }
  },
  "jest": {
    "verbose": false,
    "testRegex": "(/tests/.*(test|spec))\\.js?$",
    "moduleFileExtensions": ["js"],
    "transform": {
      "^.+\\.[t|j]sx?$": "babel-jest"
    }
  }
}
```

```js
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const host = process.env.HOST || "localhost";

module.exports = function(env, argv) {
  const mode = argv.mode || "development";
  return {
    mode: mode,
    entry: "./src/main.js",
    output: {
      filename: "main.js",
      path: path.resolve(__dirname, "dist")
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          loader: "babel-loader",
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      extensions: [".js", ".jsx"]
    },
    devServer: {
      contentBase: path.resolve(__dirname, "public/index.html"),
      compress: true,
      hot: true,
      host,
      port: 3000,
      publicPath: "/"
    },
    plugins: [
      new HtmlWebpackPlugin({
        inject: true,
        template: path.resolve(__dirname, "public/index.html")
      })
    ]
  };
};
```

With this setup, we can now use the following script commands:

```
npm run build # build the full application in prod mode in dist/

npm run dev # start a dev server with livereload

npm run test # run the jest test suite
```
