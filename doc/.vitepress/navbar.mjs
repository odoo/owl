// Shared static navbar for the documentation builds (v3 and v2).
// Injected outside Vue's DOM via transformHtml.

export function buildNavbar({ docsVersion }) {
  const v3Selected = docsVersion === "3" ? "selected" : "";
  const v2Selected = docsVersion === "2" ? "selected" : "";
  return `<nav class="site-nav" onclick="if(event.target.closest('a')){window.location=event.target.closest('a').href;event.preventDefault()}">
      <a class="site-nav-link" href="/owl/">🦉 Owl</a>
      <a class="site-nav-link active" href="/owl/documentation/">Documentation</a>
      <a class="site-nav-link" href="/owl/playground/">Playground</a>
      <button class="site-nav-search" onclick="event.stopPropagation();document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      <select class="site-nav-version" aria-label="Documentation version" onclick="event.stopPropagation()" onchange="window.location.href=this.value">
        <option value="/owl/documentation/" ${v3Selected}>v3 (current)</option>
        <option value="/owl/documentation/v2/" ${v2Selected}>v2</option>
      </select>
      <a class="site-nav-github" href="https://github.com/odoo/owl" target="_blank" aria-label="GitHub">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      </a>
    </nav>`;
}
