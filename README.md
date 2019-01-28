# Core Utility for Odoo Web Client

This is a POC, not at all production ready code!!! This application is a proof of concept of how the Odoo web client could be
redesigned.

## Installation

```
npm install
```

## Main scripts

### Testing

```
npm run test
npm run test:watch
```

### Building app

```
npm run build
npm run minify
```

These commands will build the app in dist/app, and minify the js bundle

### Developping

```
npm run dev
```

This will: build the app (without minification), then start a live-server with hot-reloading, and watch the file system to make sure
that assets are properly rebuilt if necessary, and then reloaded.

## Design goals:

- _declarative UI code_: we want to be able to declare the UI state in a template
  and trust the framework to do the job as expected
- _possibility to have 'imperative' ui code_: Odoo comes from an imperative stand
  point, and it will be easier to migrate to this new design if it is still
  possible to create and mount subwidgets manually. Also, for performance
  reasons, it makes it possible to 'drop down' an abstraction layer if necessary
  (thinking about large one2many lists for example)
- _minimalist_: less code is easier to maintain. Also, we do not want to depend
  on external libraries too much (so, for example, core code does not use jquery
  or underscore)
- _simple to reason_: if we need to choose between the ultimate design and a
  simpler design, but which requires a few more lines of code, we will go for
  the second option. For example, I think that 'observables values' could be
  better than our simple EventBus. But this would introduce more concepts that
  will be needed to be understood by our ecosystem. We want as few concepts/communications primitives as possible for our needs.
- _testable_: each part of the code should be easy to test. For example, the
  action manager takes in its constructor parameters which implements the
  IRouter and IAjax interfaces. This makes it easy to test.
- _typesafe_: the current implementation uses Typescript. I believe that using
  well defined interfaces will make our code

  - safer: no more _undefined_ is not a function
  - simpler/faster: once we are aware of the exact structure of what we are
    dealing with, we can make simpler code.

- _simple, "not enterprisy"_. We would like that developping in Odoo feels as
  simple and natural as possible, without too many abstractions/files. I feel
  that this is not really important, but there is some value in seeing a code
  source tree with tens of files (instead of hundreds). For this reason, we made
  some 'imperfect' choices: for example, most interfaces are in the same file
  as the code that uses them the most. Or we try to avoid the 'manager' word
  if possible.

Not a goal: reactiveness, or bi-directional bindings. We want to stay at a
slightly lower level of abstraction. Each widget can implement its own update
pattern.

## Architecture notes

This POC revolves around two main ideas:

- an Environment
- a generic Widget class

**Environment**: The environment is an object which gives access to many
important global partsof the application. For example, the rendering engine
QWeb, translation functions, router, services, ... The environment is supposed
to be unique (otherwise, some strange things could happen if there are two
different active routers for example), accessible to every widget (via its
parent). Also, even though it will probably happen, it is not supposed to be
imported directly by a piece of code. If some code needs access to the
environment, it should be given to him. This makes our code easier to test,
and more generic (could be reused in a different environment).

**Widget**: Widgets are UI building blocks. In this POC, we want to experiment
with a different Widget API which has the following properties:

- async hook: the willStart hook is asynchronous. We like that
- composability: we want to be able to create subwidget in a simple declarative
  way
- async rendering: because of the two previous properties, the rendering
  operation of a widget (not of QWeb) is asynchronous. This introduces a new
  class of challenges.
- mounted/willUnmount hooks: they really are missing from current Odoo Widgets
- uses a virtual dom: not really a goal, but it seems like this is necessary.
  Because of this, we had to reimplement QWeb to make it output a vnode
  representation of a widget.
- has a reference to the application environment: it is given to the root widget
  and propagated to each sub widgets. This is the key to make this component
  generic and useful.

We have 3 main folders and 3 main files:

- _core/_: this contains main building blocks for the rest of the application.
  For example, Widget. Everything in _core/_ should be generic and independant
  of any other files. This is why the Widget class is not aware of anything
  specific to Odoo: it does not know about the action manager (via its
  environment). There are two reasons for this restriction:

  1. this prevents code coupling. If no code in core depends on something
     external, this means that the abstraction is self sufficient
  2. this makes it easier to reason. One can read the code from core and
     understand it. Then the rest of Odoo builds on top of these abstractions.
  3. this forces us to have a better design. This is not easy to prove, but I
     think that generic code forces us to think more about its API.

- _services_/: here, we put classes that will be available in the application
  environment. For example, the router, the action manager, the crash manager,
  the notification system, and so on. Code here can import core files, the Env
  type, or code from other services. However, no code from widgets/ should be
  necessary.

- _widgets_/: this contains every widgets required by the Odoo web client. Code
  in this folder can import the Env type from the main env file, can import
  code from ../core/, can import other widgets, but should not import anything from the service/ folder. Also, it should not import any registry.

- _env.ts_: the global odoo environment. In this file, we define two different
  things: the Env interface (which can be imported by pretty much everything
  else), and the makeEnvironment function (which should only be imported by the
  main bootstrap file). The Env interface is a description of what each odoo
  widget will be able to access. Also, it will be accessible by every widgets.
  This will basically remove the need for trigger_up.

* _registry.ts_: this is the main registry where actions, fields, ... should be
  added. In a more normal application, this should not be necessary, but Odoo
  code is designed to be extended from the outside. Note that the registry is
  not a (direct) part of the environment. This is a conscious decision: if it
  was part of the application environment, external code that would want to add
  something to the registry would be forced to import the main environment. This
  would encourage code to mix 'declaration code', such as defining a widget and
  'control code'. Also, this would be slightly more awkward for testing. And
  finally, a stronger argument is that the environment will most likely be
  started in an asynchronous way, so it does seems weird to wait for it before
  adding something to the registry.

* _main.ts_: the main bootstrap file. This is the part that takes everything
  else, and make sure they are properly connected. Then, it make sure that the
  root widget is mounted to its desired location.

## Random Notes

- Change of behaviour: The compilation of a template should have a unique root
  node (but sub templates can have multiple roots)

## TO THINK ABOUT/TO DO

- **Qweb**

  - check qweb tests and see if it is reasonable (escaping? safety/security?)
  - remove the "if (${exprID} || ${exprID} === 0) {"
  - need to implement t-extend (?)
  - improve qweb generated code: do not assign object/array if no props/attrs/children
  - improve qweb gen code: when building a vnode, propagate a structure with
    children/attrs/hooks, fill it properly by each directive, then and only
    then create node with minimal code

- **Widget**

  - check if it is possible to remove parent reference in widget
  - default implementation of propsUpdated?
