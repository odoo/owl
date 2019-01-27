import { Widget } from "./core/widget";
import { Env } from "./env";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------
interface Type<T> extends Function {
  new (...args: any[]): T;
}

type ActionWidget = Type<Widget<Env>>;

//------------------------------------------------------------------------------
// Registry code
//------------------------------------------------------------------------------
export class Registry {
  actions: { [key: string]: ActionWidget } = {};

  addAction(name: string, action: ActionWidget): Registry {
    return this.addToRegistry(this.actions, name, action);
  }

  private addToRegistry<T>(
    map: { [k: string]: T },
    name: string,
    elem: T
  ): Registry {
    if (name in map) {
      throw new Error(`Key ${name} already exists!`);
    }
    map[name] = elem;
    return this;
  }
}

export const registry = new Registry();
