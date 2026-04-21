import { constructorType, types as coreTypes } from "@odoo/owl-core";
import { Component } from "./component";

function componentType(): typeof Component {
  return constructorType(Component as any) as any;
}

export const types = { ...coreTypes, component: componentType };
