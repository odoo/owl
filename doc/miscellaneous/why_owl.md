# 🦉 Why Owl ? 🦉

The common wisdom is that one should not reinvent the wheel, because that would
waste effort and resources. It is certainly true in many cases. A javascript
framework is a considerable investment, so it is quite logical to ask the question:
why did Odoo decide to make OWL instead of using a standard/well known framework,
such as React or Vue?

As you might expect, the answer to that question is not simple. But most of the
reasons discussed in this page are a consequence from a single fact: Odoo is
extremely modular.

This means, for example, that the core parts of Odoo are not aware, before runtime,
of what files will be loaded/executed, or what will be the state of the UI. Because
of that, Odoo cannot rely on a standard build toolchain. Also, this implies that
the core parts of Odoo need to be extremely generic. In other words, Odoo is not
really an application with a user interface. It is an application which generates
a dynamic user interface. And most frameworks are not up to the task.

Betting on Owl was not an easy choice to make, because there certainly are a lot
of conflicting needs that we want to carefully balance. Choosing anything other
than a well known framework is bound to be controversial. This page will explain
some of the reason why we still believe that building Owl is a worthwile
endeavour.

## Strategy

It is true that we want to keep control of our technology, in the sense that we
do not want to depend on Facebook or Google, or any other large (or small)
company. If they decide to change their license, or to go in a direction that
will not work for us, this may be a problem. This is even more true because
Odoo is not a conventional javascript application, and our needs are probably
quite different as most other applications.

## Class components

It is clear that the biggest frameworks are moving away from class components.
There is an implicit assumption that class components are terrible, and that
functional programming is the way to go. React even goes as far as to say that
classes are confusing for developers.

While there is some truth to that, and to the fact that composition is certainly
a good mechanism for code reuse, we believe that classes and inheritance are
important tools.

Sharing code between generic components with inheritance is the way Odoo built
its web client. And it is clear that inheritance is not the root of all evils.
It is often a perfectly simple and appropriate solution. What matter most is
the architectural decisions.

Also, Odoo has another specific use out of class components: each method of a
class provides an extension point for addons. This may not be a clean architecture
pattern, but it is a pragmatic decision that served Odoo well: classes are
sometimes monkey-patched to add behaviour from the outside. A little bit like
mixins, but from the outside.

Using React or Vue would make it significantly harder to monkey patch components,
because a lot of the state is hidden in their internals.

## Tooling

React or Vue have a huge community, and a lot of effort have been made into their
tooling. This is wonderful, but at the same time, a pretty big issue for Odoo:
since the assets are totally dynamic (and could change whenever the user installs
or removes an addon), we need to have all that kind of tooling on the production
servers. This is certainly not ideal.

Also, this makes it very complicated to setup Vue or React tools: Odoo code is
not a simple file that import other files. It changes all the time, assets
are bundled differently in different contexts. This is the reason why Odoo has
its own module system, which are resolved at runtime, by the browser. The
dynamic nature of Odoo means that we often need to delay work as late as possible
(in other word, we want a JIT user interface!)

Our ideal framework has minimal (mandatory) tooling, which makes it easier to
deploy. Using React without JSX, or Vue without vue file is not very appealing.

At the same time, Owl is designed to solve this issue: it compiles templates
by the browser, it doesn't need much code for that, since we use the XML parser
built into each browser. Owl works with or without any additional tooling. It
can use template strings to write single file components, and is easy to integrate
in any html page, with a simple `<script>` tag.

## Template based

Odoo stores templates as XML documents in a database. This is very powerful, since
this allow the use of xpaths to customize other templates. This is a very
important feature of odoo, and one of the key to Odoo modularity.

Because of that, we still expect to write our templates in an XML document.
Weirdly enough, no major framework uses XML to store templates, even though it
is extremely convenient.

So, using React or Vue means that we need to make a template compiler. For React,
that would be a compiler that would take a QWeb template, and convert it to a
React render function. For Vue, it would convert it to a Vue template. Then
we need to bundle the vue template compiler as well.

Not only this would be complex (compiling a templating language into another is
not an easy task), but it would negatively impact the developer experience as
well. Writing Vue or React components in a QWeb template would certainly be
awkward, and very confusing.

## Developer Experience

This brings us to the following point: developer experience. We see this choice
as an investment for the future, and we want to make onboarding developers as
easy as possible.

While many javascript professionals clearly think that react/vue is not difficult
(which is true to some extent), it is also true that many non js specialists are
overwhelmed with the frontend world: functional components, hooks, and many other
fancy words. Also, what is available in the compilation context may be difficult,
there is a lot of black magic going on in pretty much every framework. Vue
somehow join various namespaces into one, under the hood, and add various internal
keys. Svelte transform the code. React require that state transformations are
deep, and not shallow.

Owl is trying very hard to have a simple and familiar API. It uses classes. Its
reactivity system is explicit, not implicit. The scoping rules are obvious. In
case of doubt, we err on the side of not implementing a feature.

It is certainly different from React or Vue, but at the same time, kind of
familiar for experienced developers.

## JIT compilation

There is also a clear trend in the frontend world to compile code
as much as possible ahead of time. Most frameworks will compile templates ahead
of time. And now Svelte is trying to compile the JS code away, so it can remove
itself from the bundle.

This is certainly reasonable for many usecases. However, this is not what Odoo
needs: Odoo will fetch templates from the database and need to compile them only
at the last possible moment, so we can apply all necessary xpaths.

Even more: Odoo needs to be able to generate (and compile) templates at runtime.
Currently, Odoo form views interpret an xml description. But the form view code
then needs to do a lot of complicated operations. With Owl, we will be able to
transform a view description into a QWeb template, then compile that and use it
immediately.

## Reactivity

There are other design choices that we feel are not optimal in other frameworks.
For example, the reactivity system. We like the way Vue did it, but it has a
flaw: it is not really optional. There is actually a way to opt out of the reactivity
system by freezing the state, but then, it is freezed.

And there certainly are situations where we need a state, which is not read-only,
and not observed. For example, imagine a spreadsheet component. It may have a
very large internal state, and it knows exactly when it needs to be rendered
(basically, whenever the user performs some action). Then, observing its state
is a net performance loss, both for the CPU and the memory.

## Concurrency

Many applications are happy to simply display a spinner whenever a new asynchronous
action is performed, but Odoo wants a different user experience: most asynchronous
state changes are not displayed until ready. This is sometimes called a concurrent
mode: the UI is rendered in memory, and displayed only when it is ready (and
only if it has not been cancelled by subsequent user actions).

React has now an experimental concurrent mode, but it was not ready when Owl
started. Vue has not really an equivalent API (suspense is not what we need).

Also, React concurrent mode is complex to use. Concurrency was one of the rare
strong point of the former Odoo js framework (widgets), and we feel that Owl has
now a very strong concurrent mode, which is simple and powerful at the same time.

## Conclusion

This lengthy discussion showed that there are many small and not so small reasons
that current standard frameworks are not tailored to our needs. It is perfectly
fine, because they each chose a different set of tradeoffs.

However, we feel that there is still room in the framework world for something
that is different. For a framework that makes choices compatible with Odoo.

And that is why we built Owl 🦉.
