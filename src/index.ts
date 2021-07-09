import { App } from "./core/app";
import { Component } from "./core/component";

export { App, Component };

interface MountParameters {
  env?: any;
  target: HTMLElement;
  props?: any;
}

export async function mount<T extends typeof Component>(
  C: T,
  params: MountParameters
): Promise<InstanceType<T>> {
  const { env, props, target } = params;
  const app = new App(C, props);
  app.configure({ env });
  return app.mount(target);
}
