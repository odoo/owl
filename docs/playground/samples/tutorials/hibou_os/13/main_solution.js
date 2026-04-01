import { mount } from "@odoo/owl";
import { Hibou } from "./core/hibou";
import "./apps/clock";
import "./apps/notepad";
import "./apps/calculator";

mount(Hibou, document.body, { templates: TEMPLATES, dev: true });
