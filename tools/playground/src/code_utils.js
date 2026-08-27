import { loadJS } from "./utils.js";

let markedLoaded = null;
let highlightJsLoaded = null;
let markedHighlightLoaded = null;
let markedConfigured = false;

async function getMarked() {
  if (!markedLoaded) {
    markedLoaded = loadJS("libs/marked.min.js").then(() => {
      return window.marked;
    });
  }
  return markedLoaded;
}

async function getHighlightJS() {
  if (!highlightJsLoaded) {
    highlightJsLoaded = loadJS("libs/highlight.min.js").then(() => {
      return window.hljs;
    });
  }
  return highlightJsLoaded;
}

async function getMarkedHighlight() {
  if (!markedHighlightLoaded) {
    markedHighlightLoaded = loadJS("libs/marked-highlight.min.js").then(() => {
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
