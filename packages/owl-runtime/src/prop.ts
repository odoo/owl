import { assertType, OwlError } from "@odoo/owl-core";
import { getComponentScope } from "./component_node";

export function prop(key: string): any;
export function prop<T>(key: string, type: T): T;
export function prop<T>(key: string, type: T, defaultValue: T): T;
export function prop(key: string, type?: any, ...args: any[]): any {
  const node = getComponentScope();
  const hasDefault = args.length > 0;
  const propValue = node.props[key];

  if (node.app.dev) {
    if (type !== undefined && (!hasDefault || propValue !== undefined)) {
      assertType(propValue, type, `Invalid prop '${key}' in '${node.componentName}'`);
    }
    node.willUpdateProps.push((nextProps: Record<string, any>) => {
      if (nextProps[key] !== node.props[key]) {
        throw new OwlError(
          `Prop '${key}' changed in component '${node.componentName}'. ` +
            `Props declared with \`prop()\` are static and should not change. ` +
            `If the prop is a signal, pass the same signal reference (its inner value may change).`
        );
      }
    });
  }

  return propValue === undefined && hasDefault ? args[0] : propValue;
}
