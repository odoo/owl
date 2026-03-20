import { mount } from "@odoo/owl";
import { Hibou } from "./core/hibou";

mount(Hibou, document.body, { templates: TEMPLATES, dev: true });
