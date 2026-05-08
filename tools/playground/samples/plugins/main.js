import { Component, mount, onWillDestroy, plugin, Plugin, signal, xml } from "@odoo/owl";

// Plugins: shared, scoped state with lifecycle.
// `ClockPlugin` owns a single `setInterval` and a reactive `now` signal.
// Two clock widgets read the same plugin — they stay perfectly in sync, and
// only one interval runs no matter how many widgets are mounted.
//
// `onWillDestroy` runs when the plugin is torn down (here: when the app
// unmounts) — that's where the interval is cleared.
//
// Try: add a third widget that displays `clock.now().getFullYear()`.

class ClockPlugin extends Plugin {
    now = signal(new Date());

    setup() {
        const id = setInterval(() => this.now.set(new Date()), 1000);
        onWillDestroy(() => clearInterval(id));
    }
}

class DigitalClock extends Component {
    static template = xml`<div>🕒 <t t-out="this.clock.now().toLocaleTimeString()"/></div>`;
    clock = plugin(ClockPlugin);
}

class UTCClock extends Component {
    static template = xml`<div>🌍 UTC <t t-out="this.clock.now().toUTCString().slice(17, 25)"/></div>`;
    clock = plugin(ClockPlugin);
}

class Root extends Component {
    static components = { DigitalClock, UTCClock };
    static template = xml`
    <DigitalClock/>
    <UTCClock/>`;
}

mount(Root, document.body, { templates: TEMPLATES, plugins: [ClockPlugin], dev: true });
