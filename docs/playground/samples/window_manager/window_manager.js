// This example is slightly more complex than usual. We demonstrate
// here a way to manage sub windows in Owl, declaratively. This is still just a
// demonstration. Managing windows can be as complex as we want.  For example,
// we could implement the following features:
// - resizing windows
// - minimizing windows
// - configuration options for windows to make a window non resizeable
// - minimal width/height
// - better heuristic for initial window position
// - ...
import { Component, useState, mount, useRef, reactive, useEnv, onMounted } from "@odoo/owl";

// -----------------------------------------------------------------------------
// Window manager code
// -----------------------------------------------------------------------------

class WindowManager {
  // contains all components with metadata
  static Windows = {};
  windows = {}; // mapping id => info
  nextId = 1;

  add(type) {
    const Comp = WindowManager.Windows[type];
    const left = 50 + Math.round(Math.random()*(window.innerWidth - 50 - Comp.defaultWidth));
    const top = 50 + Math.round(Math.random()*(window.innerHeight - 100 - Comp.defaultHeight));
    const id = this.nextId++;
    this.windows[id] = {
      id, 
      title: Comp.defaultTitle,
      width: Comp.defaultWidth,
      height: Comp.defaultHeight,
      left,
      top,
      Component: Comp,
    };
  }
  
  close(id) {
    delete this.windows[id];
  }

  updatePosition(id, left, top) {
    const w = this.windows[id];
    w.left = left;
    w.top = top;
  }

  getWindows() {
    return Object.values(this.windows);
  }
}

function createWindowService() {
  return reactive(new WindowManager());
}

function useWindowService() {
  const env = useEnv();
  return useState(env.windowService);
}

// -----------------------------------------------------------------------------
// Generic Window Component
// -----------------------------------------------------------------------------

class Window extends Component {
  static template = "Window";
  static nextZIndex = 1;
  zIndex = 0;

  setup() {
    this.windowService = useWindowService();
    this.root = useRef('root');
    onMounted(this.updateZIndex);
  }

  get style() {
    let { width, height, top, left } = this.props.info;
    return `width: ${width}px;height: ${height}px;top:${top}px;left:${left}px;z-index:${this.zIndex}`;
  }

  close() {
    this.windowService.close(this.props.info.id);
  }

  startDragAndDrop(ev) {
    this.updateZIndex();
    const self = this;
    const root = this.root;

    const el = root.el;
    el.classList.add('dragging');

    const current = this.props.info;
    const offsetX = current.left - ev.pageX;
    const offsetY = current.top - ev.pageY;
    let left, top;

    window.addEventListener("mousemove", moveWindow);
    window.addEventListener("mouseup", stopDnD, { once: true });

    function moveWindow(ev) {
      left = Math.max(offsetX + ev.pageX, 0);
      top = Math.max(offsetY + ev.pageY, 0);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    }
    function stopDnD() {
      window.removeEventListener("mousemove", moveWindow);
      el.classList.remove('dragging');

      if (top !== undefined && left !== undefined) {
        self.windowService.updatePosition(current.id, left, top);
      }
    }
  }

  updateZIndex() {
    this.zIndex = Window.nextZIndex++;
    this.root.el.style['z-index'] = this.zIndex;
  }
}

// -----------------------------------------------------------------------------
// Two concrete Window type implementations
// -----------------------------------------------------------------------------

class HelloWorld extends Component {
  static template = "HelloWorld";
  static defaultTitle = "Hello Owl!";
  static defaultWidth = 200;
  static defaultHeight = 100;
}


class Counter extends Component {
  static template = "Counter";
  static defaultTitle = "Click Counter";
  static defaultWidth = 300;
  static defaultHeight = 120;
  
  state = useState({ value: 0 });
  
  inc() {
    this.state.value++;
  }
}

// register window components
WindowManager.Windows.Hello = HelloWorld;
WindowManager.Windows.Counter = Counter;

// -----------------------------------------------------------------------------
// Window Container
// -----------------------------------------------------------------------------

class WindowContainer extends Component {
  static template = "WindowContainer";
  static components = { Window };
    
  setup() {
    this.windowService = useWindowService();
  }
}

// -----------------------------------------------------------------------------
// Root Component
// -----------------------------------------------------------------------------

class Root extends Component {
  static template = "Root";
  static components = { WindowContainer };
    
  setup() {
    this.windowService = useWindowService();
  }
  
  addWindow(type) {
    this.windowService.add(type);
  }
}

// -----------------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------------

const env = {
  windowService: createWindowService(),
};

mount(Root, document.body, { templates: TEMPLATES, env, dev: true });
