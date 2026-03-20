import { mount } from "@odoo/owl";
import { ShoppingCart } from "./shopping_cart.js";

mount(ShoppingCart, document.body, { templates: TEMPLATES, dev: true });
