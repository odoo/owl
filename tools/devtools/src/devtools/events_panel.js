/** @odoo-module **/

import { Events } from "./components/events/events";
import { mount, whenReady } from "@odoo/owl";

import "../main.css";
import "../../assets/templates.js";


whenReady();
mount(Events, document.body, {dev: true});
