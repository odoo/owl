import { mount } from "@odoo/owl";
import { Hibou } from "./core/hibou";
import { clock } from "./apps/clock";
import { notepad } from "./apps/notepad";
import { calculator } from "./apps/calculator";

mount(Hibou, document.body, {
    templates: TEMPLATES,
    dev: true,
    props: { apps: [clock, notepad, calculator] },
});
