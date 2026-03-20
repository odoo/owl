# Playground Application

This is a playground application that helps the user learn and play with the
Owl framework.

## Tutorials

There are three tutorials: 

- Getting started, that aims to learn the basics of components
- Todo List, which is a real project, and learn how to use Owl in a more interesting
  situation. It teaches about lifecycle hooks, organizing code,
- Hibou OS, which is a more advanced tutorial, where we learn more about
  slots, asynchronous rendering, plugins, multiple roots, translations, and
  error handling, all through building a mini desktop environment

Each tutorial should be structured in the same way:

- a static description (in samples.js). It has a few fields (id, name,
  description, summary, steps
- each step is: an object with a title, a files mapping, and a optional
  solution mapping
- each mapping maps a file name (as seen in the explorer/UI) to a actual file
  name on the disk
- note that it is allowed to have UI files maps to the same physical file. For
  example, the solution for a step could be the starting point for the next step
- there is a button in the UI to navigate to the solution of to the starting
  point of the tutorial step. 

Each tutorial has a readme.md file which contains the instructions, and a main.js
file that provide the starting point. 



## Guidelines

- javascript files should always be indented with 4 spaces
- export statement should always be next to the exported value, not with a
  export statement at the end (so, we want `export class A {} `)
- each main.js should mount a valid owl application like this:
  ```js
  mount(Counter, document.body, { templates: TEMPLATES, dev: true });
  ```
  (the templates part and the dev true part are important)
- the readme.md for each step should have a similar structure: a short intro,
  which explains the broad objectives of the task, then a more detailed
  task explanation with a few sub tasks and code snippets, then eventually a few bonus exercises
  and finally some additional information/context to help them solve the task.
- inline templates (using the `xml` function) should start at 6 spaces of
  indentation for the first level, then 2 additional spaces for each nesting
  level. This makes them easier to work with in the playground editor.
- the `setup` method should be defined after class property declarations, not
  before them.