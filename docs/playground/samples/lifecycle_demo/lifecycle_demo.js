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

function useLogLifecycle(componentName) {
    onWillStart(() => console.log(`${componentName}:willStart`));
    onMounted(() => console.log(`${componentName}:mounted`));
    onWillUpdateProps(() => console.log(`${componentName}:willUpdateProps`));
    onWillRender(() => console.log(`${componentName}:willRender`));
    onRendered(() => console.log(`${componentName}:rendered`));
    onWillPatch(() => console.log(`${componentName}:willPatch`));
    onPatched(() => console.log(`${componentName}:patched`));
    onWillUnmount(() => console.log(`${componentName}:willUnmount`));
    onWillDestroy(() => console.log(`${componentName}:willDestroy`));
}

class DemoComponent extends Component {
    static template = "DemoComponent";

    setup() {
        useLogLifecycle("DemoComponent");
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
        useLogLifecycle("Root");
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
