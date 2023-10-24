import * as owl from "../../../src/runtime";
window.owl = owl;
import { chrome } from "jest-chrome";
window.chrome = chrome;

import { templates } from "../assets/templates";
for (const template in templates) {
  owl.App.registerTemplate(template, templates[template as keyof typeof templates]);
}
