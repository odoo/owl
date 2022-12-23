/** @odoo-module **/

import { ComponentsTree } from "./components/components_tree/components_tree";
import { mount, whenReady } from "@odoo/owl";

import "../main.css";
import "../../assets/templates.js";


whenReady();
mount(ComponentsTree, document.body, {});

