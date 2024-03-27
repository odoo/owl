# Change Log

All notable changes to the "owl-vision" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),

## [0.1.0] - 2024-11-06

### Added

- Basic autocomplete in xml files. This includes autocompletion for elements, components,
  props, attributes, and javascript expressions.

  The current implementation, while relatively simple, has a couple of drawbacks:
  - Javascript imports are not resolved by the xml autocomplete, this means that it does not
  understand the types of imported functions or objects. That said, I've added custom support
  for frequently used Owl imports, namely `useState` and `useRef`. You can add more in
  the settings if needed.
  - The autocomplete is limited to templates directly linked to components, sub-templates
  used via t-call will not get autocompletion as no component/context can be bound to them.

- "Go To Definition" support for props and javascript expressions in xml
- Support for the following directives: t-att, t-model, t-tag, t-debug, t-log

### Fixed

- Changed t-else syntax highlight from dynamic to static attribute

## [0.0.2] - 2023-2-11

### Added

- Switch Below command
- Basic syntax highlight for xpaths
- Syntax builder scripts to make syntaxes easier to read and edit
- Syntax highlight in single quote attributes
- Syntax highlight for slot props

### Fixed

- Added missing space in component's snippet indentation
- Using `Switch Besides` or `Switch Below` does not open a new panel if one was already open

## [0.0.1] - 2023-03-10

- Initial release

### Added

- Owl templates syntax highlight in xml files
- `Find Template` Command - Finds the template file of the currently selected element.
- `Find Component` Command - Finds the selected component definition.
- `Switch` Command - Finds the corresponding template or component file depending on the current file.
- `Switch Besides` Command - Finds the corresponding template or component file depending on the current file and opens it besides.
