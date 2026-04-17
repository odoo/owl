import { defineConfig } from "vitepress";
import { buildNavbar } from "./navbar.mjs";

export default defineConfig({
  title: "OWL",
  description: "Odoo Web Library - A reactive component framework for the web",
  base: "/owl/documentation/",
  head: [
    [
      "link",
      {
        rel: "icon",
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦉</text></svg>",
      },
    ],
  ],

  // The v2 docs are a separate VitePress project under doc/v2/ with its own
  // config; exclude them from the v3 build.
  srcExclude: ["v2/**"],

  // Map readme.md to index so it serves as the documentation landing page.
  rewrites: {
    "readme.md": "index.md",
  },

  // Links to ../playground/ go outside VitePress's scope (sibling in the
  // assembled site), so skip dead-link validation for them.
  ignoreDeadLinks: [/playground/],

  // Inject a static navbar into every page, outside Vue's DOM tree.
  transformHtml(code) {
    return code.replace(/<body[^>]*>/, "$&" + buildNavbar({ docsVersion: "3" }));
  },

  themeConfig: {
    siteTitle: false,

    nav: [
      { text: "GitHub", link: "https://github.com/odoo/owl" },
    ],

    sidebar: [
      { text: "Introduction", link: "/" },
      { text: "Overview", link: "/reference/overview" },
      { text: "Installation", link: "/installation" },
      {
        text: "Reference",
        items: [
          { text: "App and Roots", link: "/reference/app" },
          { text: "Component", link: "/reference/component" },
          { text: "Environment", link: "/reference/environment" },
          { text: "Error Handling", link: "/reference/error_handling" },
          { text: "Event Handling", link: "/reference/event_handling" },
          { text: "Form Bindings", link: "/reference/form_bindings" },
          { text: "Hooks", link: "/reference/hooks" },
          { text: "Plugins", link: "/reference/plugins" },
          { text: "Precompiling Templates", link: "/reference/precompiling_templates" },
          { text: "Props", link: "/reference/props" },
          { text: "Reactivity", link: "/reference/reactivity" },
          { text: "Refs", link: "/reference/refs" },
          { text: "Resources & Registries", link: "/reference/resources_and_registries" },
          { text: "Slots", link: "/reference/slots" },
          { text: "Template Syntax", link: "/reference/template_syntax" },
          { text: "Translations", link: "/reference/translations" },
          { text: "Types & Validation", link: "/reference/types_validation" },
          { text: "Utilities", link: "/reference/utils" },
        ],
      },
      {
        text: "Misc",
        items: [
          { text: "Why OWL?", link: "/miscellaneous/why_owl" },
          { text: "Design Principles", link: "/miscellaneous/design_principles" },
          { text: "Architecture", link: "/miscellaneous/architecture" },
          { text: "Compiled Templates", link: "/miscellaneous/compiled_template" },
          { text: "Concurrency Model", link: "/reference/concurrency_model" },
          { text: "Comparison", link: "/miscellaneous/comparison" },
          { text: "OWL 3 Release Notes", link: "/owl3_design" },
        ],
      },
      {
        text: "Tools",
        items: [
          { text: "DevTools", link: "/tools/devtools" },
          { text: "DevTools Guide", link: "/tools/devtools_guide" },
        ],
      },
      {
        text: "Migration",
        items: [
          { text: "OWL 2 to OWL 3", link: "/migration_owl2_to_owl3" },
          { text: "OWL 1 to OWL 2", link: "/migration_owl1_to_owl2" },
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
