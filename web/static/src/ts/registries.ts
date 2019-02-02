import { Registry } from "./core/registry";
import { Widget, Type } from "./core/widget";
import { Env } from "./env";

export const actionRegistry: Registry<Type<Widget<Env, any>>> = new Registry();
