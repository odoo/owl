import { constructorType, types as coreTypes, type Type } from "@odoo/owl-core";
import { Component } from "./component";

function componentType(): Type<typeof Component> {
  return constructorType(Component as any) as any;
}

export const types: typeof coreTypes & { component: () => Type<typeof Component> } = {
  ...coreTypes,
  component: componentType,
};
