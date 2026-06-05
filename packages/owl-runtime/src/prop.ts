import {
  assertType,
  getDefault,
  OwlError,
  type Optional,
  type StripBrands,
  type WithDefault,
} from "@odoo/owl-core";
import { getComponentScope } from "./component_node";

export function staticProp<T = any>(key: string): T;
export function staticProp<T>(key: string, type: WithDefault<T>): T;
export function staticProp<T>(key: string, type: Optional<T>): T | undefined;
export function staticProp<T>(key: string, type: T): StripBrands<T>;
export function staticProp(key: string, type?: any): any {
  const node = getComponentScope();
  const defaultFactory = getDefault(type);
  const propValue = node.props[key];

  if (node.app.dev) {
    if (type !== undefined && (!defaultFactory || propValue !== undefined)) {
      assertType(propValue, type, `Invalid prop '${key}' in '${node.componentName}'`);
    }
    node.willUpdateProps.push((nextProps: Record<string, any>) => {
      if (nextProps[key] !== node.props[key]) {
        throw new OwlError(
          `Prop '${key}' changed in component '${node.componentName}'. ` +
            `Props declared with \`props.static()\` are static and should not change. ` +
            `If the prop is a signal, pass the same signal reference (its inner value may change).`
        );
      }
    });
  }

  return propValue === undefined && defaultFactory ? defaultFactory() : propValue;
}
