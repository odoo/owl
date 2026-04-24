import { TemplateSet } from "@odoo/owl-runtime";
import { compile, parseXML } from "@odoo/owl-compiler";

export * from "@odoo/owl-runtime";

TemplateSet.compile = compile;
TemplateSet.parseXML = parseXML;
