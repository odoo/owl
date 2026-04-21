import { defineConfig } from "vitepress";
import { buildNavbar } from "./navbar.mjs";

// Re-enable this group at the top of each per-route sidebar when a second
// package lands (owl-router, owl-orm, …). For now it's noise — a single
// "Owl" entry linking to the same section the user is already in.
// const packageSwitcher = {
//   text: "Packages",
//   items: [
//     { text: "Owl", link: "/v3/owl/" },
//     { text: "Router", link: "/v3/owl-router/" },
//     { text: "ORM", link: "/v3/owl-orm/" },
//   ],
// };

const owlSidebar = [
  { text: "Introduction", link: "/v3/owl/" },
  { text: "Overview", link: "/v3/owl/reference/overview" },
  { text: "Installation", link: "/v3/owl/installation" },
  {
    text: "Reference",
    items: [
      { text: "App and Roots", link: "/v3/owl/reference/app" },
      { text: "Component", link: "/v3/owl/reference/component" },
      { text: "Environment", link: "/v3/owl/reference/environment" },
      { text: "Error Boundary", link: "/v3/owl/reference/error_boundary" },
      { text: "Error Handling", link: "/v3/owl/reference/error_handling" },
      { text: "Event Handling", link: "/v3/owl/reference/event_handling" },
      { text: "Form Bindings", link: "/v3/owl/reference/form_bindings" },
      { text: "Hooks", link: "/v3/owl/reference/hooks" },
      { text: "Plugins", link: "/v3/owl/reference/plugins" },
      { text: "Portal", link: "/v3/owl/reference/portal" },
      { text: "Precompiling Templates", link: "/v3/owl/reference/precompiling_templates" },
      { text: "Props", link: "/v3/owl/reference/props" },
      { text: "Reactivity", link: "/v3/owl/reference/reactivity" },
      { text: "Refs", link: "/v3/owl/reference/refs" },
      { text: "Registries", link: "/v3/owl/reference/registries" },
      { text: "Resources", link: "/v3/owl/reference/resources" },
      { text: "Scope", link: "/v3/owl/reference/scope" },
      { text: "Slots", link: "/v3/owl/reference/slots" },
      { text: "Suspense", link: "/v3/owl/reference/suspense" },
      { text: "Template Syntax", link: "/v3/owl/reference/template_syntax" },
      { text: "Translations", link: "/v3/owl/reference/translations" },
      { text: "Types & Validation", link: "/v3/owl/reference/types_validation" },
      { text: "Utilities", link: "/v3/owl/reference/utils" },
    ],
  },
  {
    text: "Misc",
    items: [
      { text: "Why OWL?", link: "/v3/owl/miscellaneous/why_owl" },
      { text: "Design Principles", link: "/v3/owl/miscellaneous/design_principles" },
      { text: "Architecture", link: "/v3/owl/miscellaneous/architecture" },
      { text: "Compiled Templates", link: "/v3/owl/miscellaneous/compiled_template" },
      { text: "Concurrency Model", link: "/v3/owl/reference/concurrency_model" },
      { text: "Comparison", link: "/v3/owl/miscellaneous/comparison" },
      { text: "OWL 3 Release Notes", link: "/v3/owl/owl3_design" },
    ],
  },
  {
    text: "Tools",
    items: [
      { text: "DevTools", link: "/v3/owl/tools/devtools" },
      { text: "DevTools Guide", link: "/v3/owl/tools/devtools_guide" },
    ],
  },
  {
    text: "Migration",
    items: [
      { text: "OWL 2 to OWL 3", link: "/v3/owl/migration_owl2_to_owl3" },
      { text: "OWL 1 to OWL 2", link: "/v3/owl/migration_owl1_to_owl2" },
    ],
  },
];

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

  // Links to ../playground/ and ../v2/ go outside VitePress's scope (sibling
  // in the assembled site), so skip dead-link validation for them.
  ignoreDeadLinks: [/playground/, /^(\.\/)?v2\//],

  // Inject a static navbar into every page, outside Vue's DOM tree.
  transformHtml(code) {
    return code.replace(/<body[^>]*>/, "$&" + buildNavbar({ docsVersion: "3" }));
  },

  themeConfig: {
    siteTitle: false,

    nav: [{ text: "GitHub", link: "https://github.com/odoo/owl" }],

    sidebar: {
      "/v3/owl/": owlSidebar,
      // Future per-package sidebars go here, each starting with packageSwitcher.
    },

    search: {
      provider: "local",
    },

    outline: {
      level: [2, 3],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/odoo/owl" }],
  },
});
