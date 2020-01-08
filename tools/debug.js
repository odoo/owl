/**
 * Debug Script
 *
 * This code is intended to be evaluated in an environment where owl is available,
 * to log lot of helpful information on how Owl components behave.
 */

 function debugOwl(owl, options) {
  let prefix = "[OWL_DEBUG]";
  let current;
  Object.defineProperty(owl.Component, "current", {
    get() {
      return current;
    },
    set(comp) {
      current = comp;
      const name = comp.constructor.name;
      if (options.componentBlackList && options.componentBlackList.test(name)) {
        return;
      }
      if (options.componentWhiteList && !options.componentWhiteList.test(name)) {
        return;
      }
      let __owl__;
      Object.defineProperty(current, "__owl__", {
        get() {
          return __owl__;
        },
        set(val) {
          __owl__ = val;
          debugComponent(comp, name, __owl__.id);
        }
      });
    }
  });

  function toStr(obj) {
    let str;
    try {
      str = JSON.stringify(obj || {});
    } catch (e) {
      str = "<JSON error>";
    }
    if (str.length > 200) {
      str = str.slice(0, 200) + "...";
    }
    return str;
  }

  function debugComponent(component, name, id) {
    let fullName = `${name}<id=${id}>`;
    let log = str => console.log(`${prefix} ${fullName} ${str}`);
    let shouldDebug = method => {
      if (options.methodBlackList && options.methodBlackList.includes(method)) {
        return false;
      }
      if (options.methodWhiteList && !options.methodWhiteList.includes(method)) {
        return false;
      }
      return true;
    };
    if (shouldDebug("constructor")) {
      log(`constructor, props=${toStr(component.props)}`);
    }
    if (shouldDebug("willStart")) {
      owl.hooks.onWillStart(() => {
        log(`willStart`);
      });
    }
    if (shouldDebug("mounted")) {
      owl.hooks.onMounted(() => {
        log(`mounted`);
      });
    }
    if (shouldDebug("willUpdateProps")) {
      owl.hooks.onWillUpdateProps(nextProps => {
        log(`willUpdateProps, nextprops=${toStr(nextProps)}`);
      });
    }
    if (shouldDebug("willPatch")) {
      owl.hooks.onWillPatch(() => {
        log(`willPatch`);
      });
    }
    if (shouldDebug("patched")) {
      owl.hooks.onPatched(() => {
        log(`patched`);
      });
    }
    if (shouldDebug("willUnmount")) {
      owl.hooks.onWillUnmount(() => {
        log(`willUnmount`);
      });
    }
    const __render = component.__render.bind(component);
    component.__render = function(...args) {
      log(`rendering template`);
      __render(...args);
    };
    const render = component.render.bind(component);
    component.render = function(...args) {
      const __owl__ = component.__owl__;
      let msg = `render`;
      if (!__owl__.isMounted && !__owl__.currentFiber) {
        msg += ` (warning: component is not mounted, this render has no effect)`;
      }
      log(msg);
      return render(...args);
    };
    const mount = component.mount.bind(component);
    component.mount = function(...args) {
      log(`mount`);
      return mount(...args);
    };
  }

  if (options.logScheduler) {
    let start = owl.Component.scheduler.start;
    let stop = owl.Component.scheduler.stop;
    owl.Component.scheduler.start = function () {
      if (!this.isRunning) {
        console.log(`${prefix} scheduler: start running tasks queue`);
      }
      start.call(this);
    };
    owl.Component.scheduler.stop = function () {
      if (this.isRunning) {
        console.log(`${prefix} scheduler: stop running tasks queue`);
      }
      stop.call(this);
    };
  }
  if (options.logStore) {
    let dispatch = owl.Store.prototype.dispatch;
    owl.Store.prototype.dispatch = function(action, ...payload) {
      console.log(`${prefix} store: action '${action}' dispatched. Payload: '${toStr(payload)}'`);
      return dispatch.call(this, action, ...payload);
    };
  }
}


// This debug function can then be used like this:
//
// debugOwl(owl, {
//   componentBlackList: /App/,  // regexp
//   componentWhiteList: /SomeComponent/, // regexp
//   methodBlackList: ["mounted"], // list of method names
//   methodWhiteList: ["willStart"], // list of method names
//   logScheduler: true, // display/mute scheduler logs
//   logStore: true // display/mute store logs
// });

module.exports.debugOwl = debugOwl;
