import { App } from "./app";
import { useApp as useCoreApp } from "@odoo/owl-core";

export { useEffect, useListener } from "@odoo/owl-core";

export const useApp: () => App = useCoreApp;
