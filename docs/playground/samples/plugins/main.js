import { Component, mount, plugin, xml } from "@odoo/owl";
import { corePlugins, ThemePlugin } from "./core_plugins";
import { FormView } from "./form_view";

/**
 * Plugins are the Owl 3 replacement to the environment. They can be global,
 * or local to a component and its descendants. They can perform some work, or
 * hold some state. 
 */

class Root extends Component {
    static components = { FormView };
    static template = xml`
        <div>
            <span>Navbar </span>
            <button t-on-click="() => this.themePlugin.toggle()">
                Theme: <t t-out="this.themePlugin.theme()"/>
            </button>
        </div>
        <FormView/>
    `;

    // we import here the ThemePlugin
    themePlugin = plugin(ThemePlugin)
}

// the plugins key here defines all global plugins that will be available to
// all components in this application
mount(Root, document.body, { templates: TEMPLATES, plugins: corePlugins });
