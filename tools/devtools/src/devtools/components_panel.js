/** @odoo-module **/

import { ComponentsTree } from "./components/components_tree/components_tree";
const { mount, whenReady } = owl

import "../main.css";
import "../../assets/templates.js";


whenReady();
mount(ComponentsTree, document.body, {dev: true});

