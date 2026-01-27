import { OwlError } from "../common/owl_error";
import type { App } from "./app";
import { type ComponentNode } from "./component_node";
import { PluginManager } from "./plugin_manager";
import { STATUS } from "./status";

interface ComponentContext {
  type: "component";
  app: App;
  componentName: string;
  node: ComponentNode;
  status: STATUS;
}

interface PluginContext {
  type: "plugin";
  app: App;
  manager: PluginManager;
  status: STATUS;
}

type Contexts = {
  plugin: PluginContext;
  component: ComponentContext;
};

type Context = Contexts[keyof Contexts];

export let contextStack: Context[] = [];

export function saveContext() {
  const savedStack = contextStack.slice();
  return () => {
    contextStack = savedStack;
  };
}

export function getContext<K extends keyof Contexts>(
  type?: K
): K extends string ? Contexts[K] : Context {
  const context: any = contextStack.at(-1);
  if (!context) {
    throw new OwlError(`No active context`);
  }
  if (type && type !== context.type) {
    throw new OwlError(`Expected to be in a ${type} context`);
  }
  return context;
}

interface CapturedContext {
  run<T = void>(callback: () => T): T;
  protectAsync<P extends any[], R>(callback: (...args: P) => Promise<R>): (...args: P) => Promise<R>;
  runWithAsyncProtection<T>(callback: () => Promise<T>): Promise<T>;
}

function createAsyncProtection<P extends any[], R>(context: Context, callback: (...args: P) => Promise<R>): (...args: P) => Promise<R> {
  return async function asyncContextProtection(this: any, ...args: P) {
    if (context.status > STATUS.MOUNTED) {
      throw new OwlError(`Function called after the end of life of the ${context.type}`);
    }

    const result = await callback.call(this, ...args);
    if (context.status > STATUS.MOUNTED) {
      return new Promise(() => {});
    }

    return result;
  };
}

/**
 * Captures the current context and gives methods to run
 * functions within the captured context.
 */
export function useContext(): CapturedContext {
  const context = getContext();
  return {
    run<T>(callback: () => T): T {
      contextStack.push(context);
      const result = callback();
      contextStack.pop();
      return result;
    },
    protectAsync<P extends any[], R>(callback: (...args: P) => Promise<R>): (...args: P) => Promise<R> {
      return createAsyncProtection(context, callback);
    },
    runWithAsyncProtection<T>(callback: () => Promise<T>): Promise<T> {
      return createAsyncProtection(context, callback)();
    },
  };
}
