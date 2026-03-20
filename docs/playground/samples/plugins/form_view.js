import { Component, xml, Plugin, plugin, props, proxy, providePlugins, types as t } from "@odoo/owl";
import { NotificationPlugin } from "./core_plugins";

class FormModelPlugin extends Plugin {
    record = proxy({
        name: "headphone",
        price: 43,
    });
}

class Field extends Component {
    static template = xml`
        <p t-on-click="this.updateField">
            <span t-out="this.props.descr"/>:
            <span t-out="this.model.record[this.props.field]"/>
        </p>`;
    props = props({ field: t.string, descr: t.string});

    // we can import plugins here. the model is provided by the form view,
    // and the notificationplugin is global    
    model = plugin(FormModelPlugin);
    notificationPlugin = plugin(NotificationPlugin);

    updateField() {
        this.notificationPlugin.notify(`updating field ${this.props.field}`)
    }
}

export class FormView extends Component {
    static components = { Field };
    static template = xml`
        <div style="margin:3px;border:1px solid gray;padding:3px;width:200px">
            <Field descr="'Name'" field="'name'"/>
            <Field descr="'Price'" field="'price'"/>
        </div>
    `;
    setup() {
        // a new instance of FormModelPlugin is created here, and is made
        // available for the form view, and all its children
        providePlugins([FormModelPlugin]);
        this.model = plugin(FormModelPlugin);
    }
}