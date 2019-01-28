import { Widget } from "./core/widget";
import { Env } from "./env";
import { Type } from "./types";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

type ActionWidget = Type<Widget<Env>>;

//------------------------------------------------------------------------------
// Registry code
//------------------------------------------------------------------------------
export class Registry {
  registries: { [key: string]: { [key: string]: any } } = {
    action: {}
  };

  add(type: "action", name: string, action: ActionWidget): Registry {
    if (name in this.registries[type]) {
      throw new Error(`Key ${name} already exists!`);
    }
    this.registries[type][name] = action;
    return this;
  }
}

//------------------------------------------------------------------------------
// Main registry instance
//------------------------------------------------------------------------------
export const registry = new Registry();
