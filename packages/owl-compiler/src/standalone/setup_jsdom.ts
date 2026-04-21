import jsdom from "jsdom";

// -----------------------------------------------------------------------------
// add global DOM stuff for compiler. Needs to be in a separate file so rollup
// doesn't hoist the owl imports above this block of code.
// -----------------------------------------------------------------------------
var document = new jsdom.JSDOM("", {});
var window = document.window;
global.document = window.document;
global.window = window as unknown as Window & typeof globalThis;
global.DOMParser = window.DOMParser;
global.Element = window.Element;
global.Node = window.Node;
