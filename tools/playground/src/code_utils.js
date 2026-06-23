import { loadJS } from "./utils.js";

let markedLoaded = null;
let highlightJsLoaded = null;
let markedHighlightLoaded = null;
let markedConfigured = false;

async function getMarked() {
  if (!markedLoaded) {
    markedLoaded = loadJS("https://cdn.jsdelivr.net/npm/marked/marked.min.js").then(() => {
      return window.marked;
    });
  }
  return markedLoaded;
}

async function getHighlightJS() {
  if (!highlightJsLoaded) {
    highlightJsLoaded = loadJS(
      "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"
    ).then(() => {
      return window.hljs;
    });
  }
  return highlightJsLoaded;
}

async function getMarkedHighlight() {
  if (!markedHighlightLoaded) {
    markedHighlightLoaded = loadJS(
      "https://cdn.jsdelivr.net/npm/marked-highlight@2.2.1/lib/index.umd.min.js"
    ).then(() => {
      return window.markedHighlight;
    });
  }
  return markedHighlightLoaded;
}

async function parseMarkdown(content) {
  const [markedLib, hljs, markedHighlight] = await Promise.all([
    getMarked(),
    getHighlightJS(),
    getMarkedHighlight(),
  ]);
  if (!markedConfigured) {
    markedConfigured = true;
    markedLib.use(
      markedHighlight.markedHighlight({
        highlight(code, lang) {
          if (lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (e) {}
          }
          try {
            return hljs.highlightAuto(code).value;
          } catch (e) {}
          return code;
        },
      })
    );
  }
  return markedLib.parse(content);
}

export { parseMarkdown };
