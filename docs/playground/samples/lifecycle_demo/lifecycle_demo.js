// This example shows all the possible lifecycle hooks
//
// The root component controls a sub component (DemoComponent). It logs all its lifecycle
// methods in the console.  Try modifying its state by clicking on it, or by
// clicking on the two main buttons, and look into the console to see what
// happens.
import {
    Component,
    useState,
    mount,
    useComponent,
    onWillStart,
    onMounted,
    onWillUnmount,
    onWillUpdateProps,
    onPatched,
    onWillPatch,
    onWillRender,
    onRendered,
    onWillDestroy,
} from "@odoo/owl";
  
function useLogLifecycle() {
    const component = useComponent();
    const name = component.constructor.name;
    onWillStart(() => console.log(`${name}:willStart`));
    onMounted(() => console.log(`${name}:mounted`));
    onWillUpdateProps(() => console.log(`${name}:willUpdateProps`));
    onWillRender(() => console.log(`${name}:willRender`));
    onRendered(() => console.log(`${name}:rendered`));
    onWillPatch(() => console.log(`${name}:willPatch`));
    onPatched(() => console.log(`${name}:patched`));
    onWillUnmount(() => console.log(`${name}:willUnmount`));
    onWillDestroy(() => console.log(`${name}:willDestroy`));
}

class DemoComponent extends Component {
    static template = "DemoComponent";

    setup() {
        useLogLifecycle();
        this.state = useState({ n: 0 });
    }
    increment() {
        this.state.n++;
    }
}

class Root extends Component {
    static template = "Root";
    static components = { DemoComponent };

    setup() {
        useLogLifecycle();
        this.state = useState({ n: 0, flag: true });
    }

    increment() {
        this.state.n++;
    }

    toggleSubComponent() {
        this.state.flag = !this.state.flag;
    }
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
  