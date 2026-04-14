# Plugins

Plugins are a key building block for structuring OWL applications. They replace the "environment" pattern from OWL 2 and provide a more flexible way to share state and behavior across components.

## Why Plugins?

In large applications, components often need to:

- Share common state (user session, theme, notifications)
- Access shared services (API client, router, analytics)
- Coordinate with other parts of the application

Plugins solve this by providing a dependency injection system. Instead of passing data through props at every level, components simply import the plugins they need.

## A Simple Example

```js
class NotificationPlugin extends Plugin {
  notify(message) {
    console.log(`Notify: ${message}`);
  }
}

// Global plugins are available to all components
mount(Root, document.body, { plugins: [NotificationPlugin] });

// In any component, just import the plugin
class MyComponent extends Component {
  notificationPlugin = plugin(NotificationPlugin);

  onClick() {
    this.notificationPlugin.notify("Button clicked!");
  }
}
```

## Global vs Local Plugins

- **Global plugins** (passed to `mount`) are shared across the entire application
- **Local plugins** (created with `providePlugins`) are scoped to a component and its children

This allows you to create isolated contexts, such as a form view with its own data model.
