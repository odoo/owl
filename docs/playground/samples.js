const HELLO_WORLD_JS = `import { Component, mount, xml } from "@odoo/owl";

class Root extends Component {
    static template = xml\`<div>Hello Owl!</div>\`;
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
`;

const EXAMPLES = [
  { id: "hello_world", category: "Examples", description: "Hello World", files: {} },
  {
    id: "simple_component",
    category: "Examples",
    description: "Simple component",
    files: { "main.js": "components/main.js", "main.css": "components/main.css" },
  },
  {
    id: "props_list",
    category: "Examples",
    description: "Props and list of components",
    files: {
      "main.js": "product_card/main.js",
      "main.css": "product_card/main.css",
      "product_card.js": "product_card/product_card.js",
      "product_card.xml": "product_card/product_card.xml",
    },
  },
  {
    id: "lifecycle",
    category: "Examples",
    description: "Component Lifecycle, hooks",
    files: {
      "readme.md": "lifecycle_demo/readme.md",
      "helpers.js": "lifecycle_demo/helpers.js",
      "chat_window.js": "lifecycle_demo/chat_window.js",
      "chat_window.xml": "lifecycle_demo/chat_window.xml",
      "main.js": "lifecycle_demo/main.js",
    },
  },
  {
    id: "reactivity",
    category: "Examples",
    description: "Signals, proxy, computed, effects",
    files: {
      "main.js": "reactivity/main.js",
      "shopping_cart.js": "reactivity/shopping_cart.js",
      "shopping_cart.xml": "reactivity/shopping_cart.xml",
    },
  },
  {
    id: "canvas",
    category: "Examples",
    description: "Accessing the DOM (t-ref)",
    files: { "main.js": "canvas/main.js" },
  },
  {
    id: "form",
    category: "Examples",
    description: "Form Controls (t-model)",
    files: { "main.js": "form/main.js", "main.xml": "form/main.xml" },
  },
  {
    id: "slots",
    category: "Examples",
    description: "Generic components (slots)",
    files: {
      "readme.md": "slots/readme.md",
      "dialog.css": "slots/dialog.css",
      "dialog.js": "slots/dialog.js",
      "dialog.xml": "slots/dialog.xml",
      "main.js": "slots/main.js",
    },
  },
  {
    id: "plugins",
    category: "Examples",
    description: "Coordinating code (Plugins)",
    files: {
      "readme.md": "plugins/readme.md",
      "core_plugins.js": "plugins/core_plugins.js",
      "form_view.js": "plugins/form_view.js",
      "main.js": "plugins/main.js",
    },
  },
  {
    id: "kanban_board",
    category: "Demos",
    description: "Kanban Board",
    files: {
      "main.js": "kanban_board/main.js",
      "main.xml": "kanban_board/main.xml",
      "main.css": "kanban_board/main.css",
    },
  },
  {
    id: "html_editor",
    category: "Demos",
    description: "HTML Editor",
    files: {
      "main.js": "html_editor/main.js",
      "main.css": "html_editor/main.css",
      "html_editor.js": "html_editor/html_editor/html_editor.js",
      "html_editor.xml": "html_editor/html_editor/html_editor.xml",
    },
  },
  {
    id: "web_client",
    category: "Demos",
    description: "Web Client",
    files: {
      "readme.md": "web_client/readme.md",
      "core/orm.js": "web_client/core/orm.js",
      "core/rpc.js": "web_client/core/rpc.js",
      "web_client/action_plugin.js": "web_client/web_client/action_plugin.js",
      "core/notification_plugin.js": "web_client/core/notification_plugin.js",
      "core/notification_container.js": "web_client/core/notification_container.js",
      "core/notification_container.css": "web_client/core/notification_container.css",
      "web_client/navbar.js": "web_client/web_client/navbar.js",
      "web_client/navbar.xml": "web_client/web_client/navbar.xml",
      "web_client/navbar.css": "web_client/web_client/navbar.css",
      "web_client/menu_plugin.js": "web_client/web_client/menu_plugin.js",
      "web_client/web_client.js": "web_client/web_client/web_client.js",
      "web_client/web_client.xml": "web_client/web_client/web_client.xml",
      "views/controlpanel.js": "web_client/views/controlpanel.js",
      "views/controlpanel.xml": "web_client/views/controlpanel.xml",
      "views/list_view.js": "web_client/views/list_view.js",
      "views/list_view.xml": "web_client/views/list_view.xml",
      "views/form_view.js": "web_client/views/form_view.js",
      "views/form_view.xml": "web_client/views/form_view.xml",
      "discuss/discuss.js": "web_client/discuss/discuss.js",
      "discuss/discuss.xml": "web_client/discuss/discuss.xml",
      "main.js": "web_client/main.js",
    },
  },
];

const TUTORIALS = [
  {
    id: "getting_started",
    name: "Getting Started",
    description: "Getting Started",
    summary: "Learn Owl fundamentals step by step",
    difficulty: 1,
    steps: [
      {
        title: "A simple counter",
        files: {
          "readme.md": "tutorials/getting_started/1/readme.md",
          "main.js": "tutorials/getting_started/1/main.js",
        },
        solution: {
          "main.js": "tutorials/getting_started/1/main_solution.js",
        },
      },
      {
        title: "Sub component",
        files: {
          "readme.md": "tutorials/getting_started/2/readme.md",
          "main.js": "tutorials/getting_started/1/main_solution.js",
        },
        solution: {
          "counter.js": "tutorials/getting_started/2/counter.js",
          "counter.css": "tutorials/getting_started/2/counter.css",
          "main.js": "tutorials/getting_started/2/main.js",
        },
      },
      {
        title: "Props and props validation",
        files: {
          "readme.md": "tutorials/getting_started/3/readme.md",
          "main.js": "tutorials/getting_started/3/main.js",
        },
        solution: {
          "main.js": "tutorials/getting_started/3/main_solution.js",
          "product_card.js": "tutorials/getting_started/3/product_card.js",
          "product_card.css": "tutorials/getting_started/3/product_card.css",
        },
      },
      {
        title: "Signals, computed values and t-model",
        files: {
          "readme.md": "tutorials/getting_started/4/readme.md",
          "main.js": "tutorials/getting_started/4/main.js",
        },
        solution: {
          "main.js": "tutorials/getting_started/4/main_solution.js",
        },
      },
      {
        title: "Lifecycle hooks",
        files: {
          "readme.md": "tutorials/getting_started/5/readme.md",
          "main.js": "tutorials/getting_started/5/main.js",
        },
        solution: {
          "main.js": "tutorials/getting_started/5/main_solution.js",
          "timer.js": "tutorials/getting_started/5/timer.js",
        },
      },
    ],
  },
  {
    id: "todo_list",
    name: "Todo List",
    description: "Todo List",
    summary: "Build a complete todo app with Owl",
    difficulty: 2,
    steps: [
      {
        title: "Rendering a list of components",
        files: {
          "readme.md": "tutorials/todo_list/1/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/1/todo_list.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/1/todo_list.xml",
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/1/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/1/todo_list_solution.xml",
          "todo_list/todo_item.js": "tutorials/todo_list/1/todo_item.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/1/todo_item.xml",
        },
      },
      {
        title: "Adding new Todos",
        files: {
          "readme.md": "tutorials/todo_list/2/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/1/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/1/todo_list_solution.xml",
          "todo_list/todo_item.js": "tutorials/todo_list/1/todo_item.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/1/todo_item.xml",
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/2/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/2/todo_list_solution.xml",
        },
      },
      {
        title: "Styling the Todo List",
        files: {
          "readme.md": "tutorials/todo_list/3/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/2/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/2/todo_list_solution.xml",
          "todo_list/todo_item.js": "tutorials/todo_list/1/todo_item.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/1/todo_item.xml",
        },
        solution: {
          "todo_list/todo_list.xml": "tutorials/todo_list/3/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.xml": "tutorials/todo_list/3/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/3/todo_item.css",
        },
      },
      {
        title: "Focus the input",
        files: {
          "readme.md": "tutorials/todo_list/4/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/2/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/3/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.js": "tutorials/todo_list/1/todo_item.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/3/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/3/todo_item.css",
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/4/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/4/todo_list_solution.xml",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js",
        },
      },
      {
        title: "Toggle todo completion",
        files: {
          "readme.md": "tutorials/todo_list/5/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/4/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/4/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.js": "tutorials/todo_list/1/todo_item.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/3/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/3/todo_item.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js",
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/5/todo_list_solution.js",
          "todo_list/todo_item.js": "tutorials/todo_list/5/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/5/todo_item_solution.xml",
        },
      },
      {
        title: "Reacting to data changes",
        files: {
          "readme.md": "tutorials/todo_list/6/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/5/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/4/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.js": "tutorials/todo_list/5/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/5/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/3/todo_item.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js",
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/6/todo_list_solution.js",
        },
      },
      {
        title: "Deleting todos",
        files: {
          "readme.md": "tutorials/todo_list/7/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/6/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/4/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.js": "tutorials/todo_list/5/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/5/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/3/todo_item.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js",
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/7/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/7/todo_list_solution.xml",
          "todo_list/todo_item.js": "tutorials/todo_list/7/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/7/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/7/todo_item_solution.css",
        },
      },
      {
        title: "Separating business logic from UI",
        files: {
          "readme.md": "tutorials/todo_list/8/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/7/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/7/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_item.js": "tutorials/todo_list/7/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/7/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/7/todo_item_solution.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js",
        },
        solution: {
          "todo_list/todo_list.js": "tutorials/todo_list/8/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/8/todo_list_solution.xml",
          "todo_list/todo_item.js": "tutorials/todo_list/8/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/8/todo_item_solution.xml",
          "todo_list/todo_list_plugin.js": "tutorials/todo_list/8/todo_list_plugin.js",
        },
      },
      {
        title: "Computed values",
        files: {
          "readme.md": "tutorials/todo_list/9/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/8/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/8/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/3/todo_list.css",
          "todo_list/todo_list_plugin.js": "tutorials/todo_list/8/todo_list_plugin.js",
          "todo_list/todo_item.js": "tutorials/todo_list/8/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/8/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/7/todo_item_solution.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js",
        },
        solution: {
          "todo_list/todo_list.xml": "tutorials/todo_list/9/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/9/todo_list.css",
          "todo_list/todo_list_plugin.js": "tutorials/todo_list/9/todo_list_plugin_solution.js",
        },
      },
      {
        title: "Persisting data",
        files: {
          "readme.md": "tutorials/todo_list/10/readme.md",
          "main.js": "tutorials/todo_list/1/main.js",
          "todo_list/todo_list.js": "tutorials/todo_list/8/todo_list_solution.js",
          "todo_list/todo_list.xml": "tutorials/todo_list/9/todo_list_solution.xml",
          "todo_list/todo_list.css": "tutorials/todo_list/9/todo_list.css",
          "todo_list/todo_list_plugin.js": "tutorials/todo_list/9/todo_list_plugin_solution.js",
          "todo_list/todo_item.js": "tutorials/todo_list/8/todo_item_solution.js",
          "todo_list/todo_item.xml": "tutorials/todo_list/8/todo_item_solution.xml",
          "todo_list/todo_item.css": "tutorials/todo_list/7/todo_item_solution.css",
          "todo_list/utils.js": "tutorials/todo_list/4/utils.js",
        },
        solution: {
          "main.js": "tutorials/todo_list/10/main_solution.js",
          "todo_list/todo_list.js": "tutorials/todo_list/10/todo_list_solution.js",
          "todo_list/todo_list_plugin.js": "tutorials/todo_list/10/todo_list_plugin_solution.js",
          "storage_plugin.js": "tutorials/todo_list/10/storage_plugin.js",
        },
      },
    ],
  },
  {
    id: "hibou_os",
    name: "Hibou OS",
    description: "Hibou OS",
    summary: "Build a mini desktop environment",
    difficulty: 3,
    steps: [
      {
        title: "The Desktop",
        files: {
          "readme.md": "tutorials/hibou_os/1/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/1/hibou.js",
          "core/hibou.xml": "tutorials/hibou_os/1/hibou.xml",
        },
        solution: {
          "core/hibou.js": "tutorials/hibou_os/1/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/1/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/1/taskbar.js",
          "core/taskbar.xml": "tutorials/hibou_os/1/taskbar.xml",
          "core/taskbar.css": "tutorials/hibou_os/1/taskbar.css",
        },
      },
      {
        title: "The System Tray Clock",
        files: {
          "readme.md": "tutorials/hibou_os/2/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/1/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/1/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/1/taskbar.js",
          "core/taskbar.xml": "tutorials/hibou_os/1/taskbar.xml",
          "core/taskbar.css": "tutorials/hibou_os/1/taskbar.css",
        },
        solution: {
          "core/taskbar.js": "tutorials/hibou_os/2/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/2/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/clock.js": "tutorials/hibou_os/2/clock.js",
          "core/clock.xml": "tutorials/hibou_os/2/clock.xml",
        },
      },
      {
        title: "The Window Component",
        files: {
          "readme.md": "tutorials/hibou_os/3/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/1/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/1/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/2/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/2/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/clock.js": "tutorials/hibou_os/2/clock.js",
          "core/clock.xml": "tutorials/hibou_os/2/clock.xml",
        },
        solution: {
          "core/hibou.js": "tutorials/hibou_os/3/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/3/hibou_solution.xml",
          "core/window.js": "tutorials/hibou_os/3/window.js",
          "core/window.xml": "tutorials/hibou_os/3/window.xml",
          "core/window.css": "tutorials/hibou_os/3/window.css",
        },
      },
      {
        title: "Opening a second window",
        files: {
          "readme.md": "tutorials/hibou_os/4/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/3/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/3/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/2/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/2/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/clock.js": "tutorials/hibou_os/2/clock.js",
          "core/clock.xml": "tutorials/hibou_os/2/clock.xml",
          "core/window.js": "tutorials/hibou_os/3/window.js",
          "core/window.xml": "tutorials/hibou_os/3/window.xml",
          "core/window.css": "tutorials/hibou_os/3/window.css",
        },
        solution: {
          "core/hibou.js": "tutorials/hibou_os/4/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/4/hibou_solution.xml",
          "core/taskbar.js": "tutorials/hibou_os/4/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/4/taskbar_solution.xml",
          "core/window.js": "tutorials/hibou_os/4/window.js",
          "core/window.xml": "tutorials/hibou_os/4/window.xml",
        },
      },
      {
        title: "The Window Manager Plugin",
        files: {
          "readme.md": "tutorials/hibou_os/5/readme.md",
          "main.js": "tutorials/hibou_os/1/main.js",
          "core/hibou.js": "tutorials/hibou_os/4/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/4/hibou_solution.xml",
          "core/hibou.css": "tutorials/hibou_os/1/hibou_solution.css",
          "core/taskbar.js": "tutorials/hibou_os/4/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/4/taskbar_solution.xml",
          "core/taskbar.css": "tutorials/hibou_os/2/taskbar_solution.css",
          "core/clock.js": "tutorials/hibou_os/2/clock.js",
          "core/clock.xml": "tutorials/hibou_os/2/clock.xml",
          "core/window.js": "tutorials/hibou_os/4/window.js",
          "core/window.xml": "tutorials/hibou_os/4/window.xml",
          "core/window.css": "tutorials/hibou_os/3/window.css",
        },
        solution: {
          "core/hibou.js": "tutorials/hibou_os/5/hibou_solution.js",
          "core/hibou.xml": "tutorials/hibou_os/5/hibou_solution.xml",
          "core/taskbar.js": "tutorials/hibou_os/5/taskbar_solution.js",
          "core/taskbar.xml": "tutorials/hibou_os/5/taskbar_solution.xml",
          "core/window_manager_plugin.js": "tutorials/hibou_os/5/window_manager_plugin.js",
          "core/managed_window.js": "tutorials/hibou_os/5/managed_window.js",
          "core/managed_window.xml": "tutorials/hibou_os/5/managed_window.xml",
          "apps/clock_app.js": "tutorials/hibou_os/5/clock_app.js",
          "apps/clock_app.xml": "tutorials/hibou_os/5/clock_app.xml",
        },
      },
    ],
  },
];

const fileCache = {};
const loadFile = (path) => {
  if (!(path in fileCache)) {
    fileCache[path] = fetch(path).then((result) => {
      if (!result.ok) {
        throw new Error("Error while fetching xml templates");
      }
      return result.text();
    });
  }
  return fileCache[path];
};

async function loadFilesFromMapping(fileMapping) {
  const entries = await Promise.all(
    Object.entries(fileMapping).map(async ([playgroundName, actualPath]) => {
      try {
        const content = await loadFile(`./samples/${actualPath}`);
        return [playgroundName, content];
      } catch {
        return null;
      }
    })
  );
  return Object.fromEntries(entries.filter(Boolean));
}

export { HELLO_WORLD_JS, EXAMPLES, TUTORIALS, fileCache, loadFile, loadFilesFromMapping };
