import { defineConfig } from "vitepress";
import { buildNavbar } from "../../.vitepress/navbar.mjs";

export default defineConfig({
  title: "OWL (v2)",
  description: "Odoo Web Library - v2 documentation",
  base: "/owl/documentation/v2/",
  head: [
    [
      "link",
      {
        rel: "icon",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦉</text></svg>",
      },
    ],
  ],

  rewrites: {
    "readme.md": "index.md",
  },

  ignoreDeadLinks: true,

  transformHtml(code) {
    return code.replace(/<body[^>]*>/, "$&" + buildNavbar({ docsVersion: "2" }));
  },

  themeConfig: {
    siteTitle: false,

    nav: [{ text: "GitHub", link: "https://github.com/odoo/owl" }],

    sidebar: [
      { text: "Overview", link: "/" },
      {
        text: "Learning",
        items: [
          { text: "Quick Start", link: "/learning/quick_start" },
          { text: "Tutorial: Todo App", link: "/learning/tutorial_todoapp" },
          { text: "How to Test", link: "/learning/how_to_test" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "App", link: "/reference/app" },
          { text: "Component", link: "/reference/component" },
          { text: "Concurrency Model", link: "/reference/concurrency_model" },
          { text: "Environment", link: "/reference/environment" },
          { text: "Error Handling", link: "/reference/error_handling" },
          { text: "Event Handling", link: "/reference/event_handling" },
          { text: "Hooks", link: "/reference/hooks" },
          { text: "Input Bindings", link: "/reference/input_bindings" },
          { text: "Portal", link: "/reference/portal" },
          { text: "Precompiling Templates", link: "/reference/precompiling_templates" },
          { text: "Props", link: "/reference/props" },
          { text: "Reactivity", link: "/reference/reactivity" },
          { text: "Refs", link: "/reference/refs" },
          { text: "Slots", link: "/reference/slots" },
          { text: "Templates", link: "/reference/templates" },
          { text: "Translations", link: "/reference/translations" },
          { text: "Utilities", link: "/reference/utils" },
        ],
      },
      {
        text: "Miscellaneous",
        items: [
          { text: "Why OWL?", link: "/miscellaneous/why_owl" },
          { text: "Architecture", link: "/miscellaneous/architecture" },
          { text: "Compiled Templates", link: "/miscellaneous/compiled_template" },
          { text: "Comparison", link: "/miscellaneous/comparison" },
        ],
      },
      {
        text: "Tools",
        items: [
          { text: "DevTools", link: "/tools/devtools" },
          { text: "DevTools Guide", link: "/tools/devtools_guide" },
        ],
      },
    ],

    search: {
      provider: "local",
    },

    outline: {
      level: [2, 3],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/odoo/owl" }],
  },
});
