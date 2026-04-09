/** @odoo-module **/

import { DevtoolsWindow } from "./devtools_window/devtools_window";
import { StorePlugin } from "./store/store";
import { ComponentsPlugin } from "./store/components_plugin";
import { ProfilerPlugin } from "./store/profiler_plugin";
const { mount } = owl;
import { templates } from "../../assets/templates.js";

for (const template in templates) {
  owl.App.registerTemplate(template, templates[template]);
}
mount(DevtoolsWindow, document.body, { plugins: [StorePlugin, ComponentsPlugin, ProfilerPlugin] });
