export interface Browser {
  setTimeout: Window["setTimeout"];
  clearTimeout: Window["clearTimeout"];
  setInterval: Window["setInterval"];
  clearInterval: Window["clearInterval"];
  requestAnimationFrame: Window["requestAnimationFrame"];
  random: Math["random"];
  Date: typeof Date;
  fetch: Window["fetch"];
  localStorage: Window["localStorage"];
}

let localStorage: Window["localStorage"] | null = null;

export const browser: Browser = {
  setTimeout: window.setTimeout.bind(window),
  clearTimeout: window.clearTimeout.bind(window),
  setInterval: window.setInterval.bind(window),
  clearInterval: window.clearInterval.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  random: Math.random,
  Date: window.Date,
  fetch: (window.fetch || (() => {})).bind(window),
  get localStorage() {
    return localStorage || window.localStorage;
  },
  set localStorage(newLocalStorage: Window["localStorage"]) {
    localStorage = newLocalStorage;
  },
};
