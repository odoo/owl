# Examples

This project features three example to illustrate how to work with the web-core framework:

- _benchmarks_ is a small application to test large number of widgets,

## Benchmarks

This example is just a playground to experiment/showcase some features of the framework, with large number of widgets.

```
npm run example:benchmarks:build # make a build in dist/examples/
npm run example:benchmarks:dev   # make a build in dist/examples/, and make a live server to access it
```

The benchmarks application generates a large number of demo messages, and display them in a list, with a few buttons that can
be used to alter the number of visible widgets.

Note that each message is itself a widget, with a sub widget. This
example could be made faster (by not using subwidgets), but the point is to observe/measure the overhead of the Component class.
