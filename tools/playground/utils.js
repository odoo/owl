export function debounce(func, wait, immediate) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    function later() {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    }
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
}

export function useBus(bus, evName, cb) {
  bus.addEventListener(evName, cb);
  owl.onWillUnmount(() => {
    bus.removeEventListener(evName, cb);
  });
}

const loadedScripts = {};

export function loadJS(url) {
  if (url in loadedScripts) {
    return loadedScripts[url];
  }
  const promise = new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = url;
    script.onload = function () {
      resolve();
    };
    script.onerror = function () {
      reject(`Error loading file '${url}'`);
    };
    const head = document.head || document.getElementsByTagName("head")[0];
    head.appendChild(script);
  });
  loadedScripts[url] = promise;
  return promise;
}
