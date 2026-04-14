import { Registry, Component, Plugin, types as t } from "@odoo/owl";

export const menuItemRegistry = new Registry({
    name: "menuItem",
    validation: t.object({
        name: t.string(),
        icon: t.string(),
        window: t.constructor(Component),
        "width?": t.number(),
        "height?": t.number(),
    }),
});

export const systrayItemRegistry = new Registry({
    name: "systrayItem",
});

export const pluginRegistry = new Registry({
    name: "plugin",
});
