/** @odoo-module **/

import { Events } from "./components/events/events";
const { mount, whenReady } = owl

import "../main.css";
import "../../assets/templates.js";


whenReady();
mount(Events, document.body, {dev: true});
