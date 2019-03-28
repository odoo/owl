const HELLO_WORLD = `class HelloWorld extends owl.core.Component {
  inlineTemplate = \`<div>Hello <t t-esc="props.name"/></div>\`;
}

const env = {
    qweb: new owl.core.QWeb()
};

const hello = new HelloWorld(env, { name: "World" });
hello.mount(document.body);
`;

const WIDGET_COMPOSITION = `class Counter extends owl.core.Component {
  inlineTemplate = \`
    <div>
      <button t-on-click="increment(-1)">-</button>
      <span style="font-weight:bold">Value: <t t-esc="state.value"/></span>
      <button t-on-click="increment(1)">+</button>
    </div>\`;

  constructor(parent, props) {
    super(parent, props);
    this.state = {
      value: props.initialState || 0
    };
  }

  increment(delta) {
    this.updateState({ value: this.state.value + delta });
  }
}

class App extends owl.core.Component {
  inlineTemplate = \`
    <div>
        <t t-widget="Counter" t-props="{initialState: 1}"/>
        <t t-widget="Counter" t-props="{initialState: 42}"/>
    </div>\`;

  widgets = { Counter };
}

const env = {
  qweb: new owl.core.QWeb()
};

const app = new App(env);
app.mount(document.body);
`;

const BENCHMARK_APP = `// todo`;
const STATE_MANAGEMENT = `// todo`;

const EMPTY = ``;

export const SAMPLES = [
  {
    description: "Hello World",
    code: HELLO_WORLD
  },
  {
    description: "Widget Composition",
    code: WIDGET_COMPOSITION
  },
  {
    description: "Benchmark application",
    code: BENCHMARK_APP
  },
  {
    description: "State management app",
    code: STATE_MANAGEMENT
  },
  {
    description: "Empty",
    code: EMPTY
  }
];
