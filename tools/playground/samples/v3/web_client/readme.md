# Web Client Demo

This example demonstrates how to build a web client application using OWL's plugin system.

## Structure

- `core/` - Core utilities and plugins
  - `orm.js` - A reactive ORM for managing data models
  - `action_plugin.js` - Plugin for handling actions/navigation
  - `notification_plugin.js` - Plugin for displaying notifications
  - `notification_container.js` - Component that renders notifications
- `web_client/` - Main web client components
  - `web_client.js` - Root component
  - `navbar.js` - Top navigation bar
- `views/` - View components
  - `list_view.js` - List view for displaying records
  - `form_view.js` - Form view for editing records
  - `controlpanel.js` - Control panel with search/filter controls
- `discuss/` - Discuss app component

## Plugins

The web client uses OWL's plugin system to share state and functionality across components:

- **NotificationPlugin**: Global plugin for showing toast notifications
- **ActionPlugin**: Will handle navigation between views
