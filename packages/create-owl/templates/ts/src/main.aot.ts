// AOT entry point: templates are precompiled by `compile_owl_templates`
// (see the dev/build scripts in package.json). The compiler is not bundled.
// To switch to JIT, edit index.html to point at /src/main.jit.ts instead.
import { mount } from "@odoo/owl-runtime";
import { App } from "./App";
import { templates } from "./templates.compiled.js";

mount(App, document.body, { templates });
