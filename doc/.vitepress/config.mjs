import { defineConfig } from "vitepress";
import { buildNavbar } from "./navbar.mjs";
import fs from "fs";
import path from "path";
import { getShikiGrammars } from "../../tools/shiki-grammars.mjs";

const packageSwitcher = {
  text: "Packages",
  items: [
    { text: "Owl", link: "/v3/owl/" },
    { text: "ORM", link: "/v3/owl-orm/" },
  ],
};

const owlSidebar = [
  packageSwitcher,
  { text: "Introduction", link: "/v3/owl/" },
  { text: "Overview", link: "/v3/owl/reference/overview" },
  {
    text: "Reference",
    items: [
      { text: "App and Roots", link: "/v3/owl/reference/app" },
      { text: "Component", link: "/v3/owl/reference/component" },
      { text: "Computed Values", link: "/v3/owl/reference/computed_values" },
      { text: "Concurrency Model", link: "/v3/owl/reference/concurrency_model" },
      { text: "Effects", link: "/v3/owl/reference/effects" },
      { text: "Error Boundary", link: "/v3/owl/reference/error_boundary" },
      { text: "Error Handling", link: "/v3/owl/reference/error_handling" },
      { text: "Event Handling", link: "/v3/owl/reference/event_handling" },
      { text: "Form Bindings", link: "/v3/owl/reference/form_bindings" },
      { text: "Hooks", link: "/v3/owl/reference/hooks" },
      { text: "Plugins", link: "/v3/owl/reference/plugins" },
      { text: "Portal", link: "/v3/owl/reference/portal" },
      { text: "Props", link: "/v3/owl/reference/props" },
      { text: "Proxies", link: "/v3/owl/reference/proxies" },
      { text: "Reactivity", link: "/v3/owl/reference/reactivity" },
      { text: "Refs", link: "/v3/owl/reference/refs" },
      { text: "Registries", link: "/v3/owl/reference/registries" },
      { text: "Resources", link: "/v3/owl/reference/resources" },
      { text: "Scope", link: "/v3/owl/reference/scope" },
      { text: "Signals", link: "/v3/owl/reference/signals" },
      { text: "Slots", link: "/v3/owl/reference/slots" },
      { text: "Suspense", link: "/v3/owl/reference/suspense" },
      { text: "Template Syntax", link: "/v3/owl/reference/template_syntax" },
      { text: "Translations", link: "/v3/owl/reference/translations" },
      { text: "Types & Validation", link: "/v3/owl/reference/types_validation" },
      { text: "Utilities", link: "/v3/owl/reference/utils" },
    ],
  },
  {
    text: "Deployment",
    items: [
      { text: "Installation", link: "/v3/owl/installation" },
      { text: "Precompiling Templates", link: "/v3/owl/reference/precompiling_templates" },
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
      { text: "OWL 3 Release Notes", link: "/v3/owl/owl3_design" },
      { text: "OWL 2 to OWL 3", link: "/v3/owl/migration_owl2_to_owl3" },
      { text: "OWL 1 to OWL 2", link: "/v3/owl/migration_owl1_to_owl2" },
    ],
  },
];

const owlOrmSidebar = [
  packageSwitcher,
  { text: "Introduction", link: "/v3/owl-orm/" },
  { text: "Overview", link: "/v3/owl-orm/reference/overview" },
  { text: "Examples", link: "/v3/owl-orm/reference/examples" },
  {
    text: "Reference",
    items: [
      { text: "Model", link: "/v3/owl-orm/reference/model" },
      { text: "Fields", link: "/v3/owl-orm/reference/fields" },
      { text: "ORM", link: "/v3/owl-orm/reference/orm" },
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
  markdown: {
    anchor: {
      // adapted from https://medium.com/@mhagemann/the-ultimate-way-to-slugify-a-url-string-in-javascript-b8e4a0d849e1
      slugify: function (str) {
        const a = "àáäâãåăæçèéëêǵḧìíïîḿńǹñòóöôœøṕŕßśșțùúüûǘẃẍÿź·_,:;";
        const b = "aaaaaaaaceeeeghiiiimnnnooooooprssstuuuuuwxyz-----";
        const p = new RegExp(a.split("").join("|"), "g");
        return str
          .toString()
          .toLowerCase()
          .replace(/\//g, "") // remove /
          .replace(/\s+/g, "-") // Replace spaces with -
          .replace(p, (c) => b.charAt(a.indexOf(c))) // Replace special characters
          .replace(/&/g, "-and-") // Replace & with 'and'
          .replace(/[^\w\-]+/g, "") // Remove all non-word characters
          .replace(/\-\-+/g, "-") // Replace multiple - with single -
          .replace(/^-+/, "") // Trim - from start of text
          .replace(/-+$/, ""); // Trim - from end of text
      }
    },
    languages: [
      'typescript', 'javascript', 'xml', 'html', 'css',
      ...getShikiGrammars(),
    ],
  },

  // The v2 docs are a separate VitePress project under doc/v2/ with its own
  // config; exclude them from the v3 build.
  srcExclude: ["v2/**"],

  // Links to ../playground/ and ../v2/ go outside VitePress's scope (sibling
  // in the assembled site), so skip dead-link validation for them. The v2
  // pattern matches a `v2/` path segment at any relative depth (`v2/`,
  // `./v2/`, `../../../v2/`, …).
  ignoreDeadLinks: [/playground/, /(^|\/)v2\//],

  // Inject a static navbar into every page, outside Vue's DOM tree.
  transformHtml(code) {
    return code.replace(/<body[^>]*>/, "$&" + buildNavbar({ docsVersion: "3" }));
  },

  themeConfig: {
    siteTitle: false,

    nav: [{ text: "GitHub", link: "https://github.com/odoo/owl" }],

    sidebar: {
      "/v3/owl/": owlSidebar,
      "/v3/owl-orm/": owlOrmSidebar,
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
