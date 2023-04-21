// In this example, we show how hooks can be used or defined.
import { Component, mount, useState, onWillDestroy } from "@odoo/owl";

// We define here a custom behaviour: this hook tracks the state of the mouse
// position
function useMouse() {
    const position = useState({x:0, y: 0});

    function update(e) {
      position.x = e.clientX;
      position.y = e.clientY;
    }
    window.addEventListener('mousemove', update);
    onWillDestroy(() => {
        window.removeEventListener('mousemove', update);
    });

    return position;
}


// Main root component
class Root extends Component {
    static template = "Root";

    setup() {
        // simple state hook (reactive object)
        this.counter = useState({ value: 0 });

        // this hooks is bound to the 'mouse' property.
        this.mouse = useMouse();
    }

    increment() {
        this.counter.value++;
    }
}

// Application setup
mount(Root, document.body, { templates: TEMPLATES, dev: true });
