// -----------------------------------------------------------------------------
// Template contract
// -----------------------------------------------------------------------------
//
// A compiled template is a function of `(app, bdom, helpers)` returning the
// render function (see TemplateFunction). The generated code only calls what
// these types describe: the code generator emits these names, and owl-runtime
// provides objects that implement them.
//
// Values that the generated code only passes along (contexts, nodes, blocks,
// the app, ...) are typed `any`: their shape belongs to the runtime, which
// types them precisely on its side. What the compiler decides is typed here:
// the names, the order of the arguments, and the static values it emits
// (strings, booleans, lists).
// -----------------------------------------------------------------------------

/**
 * The blockdom functions a compiled template uses to build its blocks.
 */
export interface TemplateBlockDom {
  text(value: string): any;
  createBlock(template: string): (data?: any[], children?: any[]) => any;
  list(children: any[]): any;
  multi(children: any[]): any;
  html(value: string): any;
  toggler(key: string, child: any): any;
}

/**
 * The helpers a compiled template calls at render time.
 */
export interface TemplateHelpers {
  // values of the `globalValues` option of the template set
  __globals__: object;
  zero: symbol;
  OwlError: new (message?: string) => Error;
  withDefault(value: any, defaultValue: any): any;
  withKey(elem: any, key: string): any;
  prepareList(collection: any): [any[], any[], number, undefined[]];
  toNumber(value: string): number | string;
  LazyValue: new (fn: any, ctx: any, component: any, node: any, key: any) => { evaluate(): any };
  safeOutput(value: any, defaultValue?: any): any;
  markRaw<T extends object>(value: T): T;
  createCatcher(eventsSpec: Record<string, number>): (child: any, handlers: any[]) => any;
  callHandler(fn: any, ctx: any, ev: Event): void;
  modelExpr(value: any): any;
  createRef(ref: any, node: any): (el: any, previousEl: any) => void;
  toSignal(node: any, cacheKey: string, value: any): any;
  callTemplate(name: string, owner: any, templates: any, ctx: any, parent: any, key: string): any;
  callSlot(
    ctx: any,
    parent: any,
    key: string,
    name: string,
    dynamic: boolean,
    extra: any,
    defaultContent?: (ctx: any, node: any, key: string) => any
  ): any;
  createComponent(
    name: string | null,
    isStatic: boolean,
    hasSlotsProp: boolean,
    hasDynamicPropList: boolean,
    propList: string[]
  ): (props: any, key: string, node: any, parent: any, C: any) => any;
}
