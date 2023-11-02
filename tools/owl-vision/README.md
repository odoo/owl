# 🦉 Owl Vision 🕶️

Owl Vision is an extension for the amazing [Owl framework](https://github.com/odoo/owl) that complements your templates with beautiful colors and allows you to more easily navigate between components and templates.

![Syntax highlight preview](https://raw.githubusercontent.com/odoo/owl/master/tools/owl-vision/assets/syntax_highlight.png)

This extension also adds:
- A basic component snippent.
- "Go to definition" providers for component tags in xml or in inline templates.

## Commands

* `Owl Vision: Find Template`:
    - If the cursor is on a template name, finds the corresponding template.
    - If the cursor is on a component, finds the template of the selected component.
* `Owl Vision: Find Component`: Finds the selected component definition.
* `Owl Vision: Switch`: Finds the corresponding template or component depending on the current file.
* `Owl Vision: Switch (Besides)`: Finds the corresponding template or component depending on the current file and opens it besides.
* `Owl Vision: Switch (Below)`: Finds the corresponding template or component depending on the current file and opens it below.

## Settings

* `owl-vision.include`: Glob filter for files to include while searching.
* `owl-vision.exclude`: Glob filter for files to exclude while searching.

## Troubleshooting

### *The extension cannot find my templates/components*

The include and exclude settings have default values that may not work with your project structure, try adapting them.
