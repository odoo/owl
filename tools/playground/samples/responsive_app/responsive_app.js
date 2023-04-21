// In this example, we show how one can design an application that is responsive:
// its UI is different in mobile mode or in desktop mode.
//
// The main idea is to have a "isMobile" key in the environment, then listen
// to resize events and update the env if needed.  Then, the whole interface
// will be updated, creating and destroying components as needed.
//
// To see this in action, try resizing the window.  The application will switch
// to mobile mode whenever it has less than 768px.
import { Component, useState, mount, reactive, useEnv } from "@odoo/owl";

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

function debounce(func, wait, immediate) {
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

//------------------------------------------------------------------------------
// Responsive hook
//------------------------------------------------------------------------------

function createUI() {
  const getIsMobile = () => window.innerWidth <= 768;

  const ui = reactive({ isMobile: getIsMobile() });

    const updateEnv = debounce(() => {
      const isMobile = getIsMobile();
        if (ui.isMobile !== isMobile) {
            ui.isMobile = isMobile;
        }
    }, 15);
    window.addEventListener("resize", updateEnv);
    return ui;
}

function useUI() {
  const env = useEnv();
  return useState(env.ui);
}


//------------------------------------------------------------------------------
// Components
//------------------------------------------------------------------------------
class Navbar extends Component {
  static template = "Navbar";
}

class MobileSearchView extends Component {
  static template = "MobileSearchView";
}

class ControlPanel extends Component {
  static template = "ControlPanel";
  static components = { MobileSearchView };
  setup() {
    this.ui = useUI();
  }
}

class AdvancedComponent extends Component {
  static template = "AdvancedComponent";
}

class FormView extends Component {
  static template = "FormView";
  static components = { AdvancedComponent };
  setup() {
    this.ui = useUI();
  }
}

class Chatter extends Component {
    static template = "Chatter";

    setup() {
        this.messages = Array.from(Array(100).keys());
    }
}

class Root extends Component {
  static template = "Root";
  static components = { Navbar, ControlPanel, FormView, Chatter };

  setup() {
    this.ui = useUI();
  }
}



//------------------------------------------------------------------------------
// Application Startup
//------------------------------------------------------------------------------
const env = {
  ui: createUI()
};

mount(Root, document.body, { templates: TEMPLATES, env, dev: true });
