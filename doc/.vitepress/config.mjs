import { defineConfig } from "vitepress";

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

  // Map readme.md to index so it serves as the documentation landing page.
  rewrites: {
    "readme.md": "index.md",
  },

  // Links to ../playground/ go outside VitePress's scope (sibling in the
  // assembled site), so skip dead-link validation for them.
  ignoreDeadLinks: [/playground/],

  // Inject a static navbar into every page, outside Vue's DOM tree.
  transformHtml(code) {
    const navbar = `<nav class="site-nav" onclick="if(event.target.closest('a')){window.location=event.target.closest('a').href;event.preventDefault()}">
      <a class="site-nav-link" href="/owl/">🦉 Owl</a>
      <a class="site-nav-link active" href="/owl/documentation/">Documentation</a>
      <a class="site-nav-link" href="/owl/playground/">Playground</a>
      <button class="site-nav-search" onclick="event.stopPropagation();document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <a class="site-nav-github" href="https://github.com/odoo/owl" target="_blank" aria-label="GitHub">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      </a>
    </nav>`;
    return code.replace(/<body[^>]*>/, "$&" + navbar);
  },

  themeConfig: {
    siteTitle: false,

    nav: [
      { text: "GitHub", link: "https://github.com/odoo/owl" },
    ],

    sidebar: [
      { text: "Introduction", link: "/" },
      {
        text: "API Reference",
        items: [
          { text: "Overview", link: "/reference/overview" },
          { text: "App", link: "/reference/app" },
          { text: "Component", link: "/reference/component" },
          { text: "Template Syntax", link: "/reference/template_syntax" },
          { text: "Reactivity", link: "/reference/reactivity" },
          { text: "Props", link: "/reference/props" },
          { text: "Hooks", link: "/reference/hooks" },
          { text: "Plugins", link: "/reference/plugins" },
          { text: "Event Handling", link: "/reference/event_handling" },
          { text: "Form Bindings", link: "/reference/form_bindings" },
          { text: "Slots", link: "/reference/slots" },
          { text: "Refs", link: "/reference/refs" },
          { text: "Error Handling", link: "/reference/error_handling" },
          { text: "Environment", link: "/reference/environment" },
          { text: "Concurrency Model", link: "/reference/concurrency_model" },
          { text: "Resources & Registries", link: "/reference/resources_and_registries" },
          { text: "Translations", link: "/reference/translations" },
          { text: "Types & Validation", link: "/reference/types_validation" },
          { text: "Utilities", link: "/reference/utils" },
          { text: "Precompiling Templates", link: "/reference/precompiling_templates" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Why OWL?", link: "/miscellaneous/why_owl" },
          { text: "Design Principles", link: "/miscellaneous/design_principles" },
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
      {
        text: "Migration",
        items: [
          { text: "OWL 2 to OWL 3", link: "/migration_owl2_to_owl3" },
          { text: "OWL 1 to OWL 2", link: "/migration_owl1_to_owl2" },
        ],
      },
      {
        text: "Design",
        items: [{ text: "OWL 3 Design", link: "/owl3_design" }],
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
