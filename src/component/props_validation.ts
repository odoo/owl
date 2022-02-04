import { ComponentConstructor } from "./component";

/**
 * Apply default props (only top level).
 *
 * Note that this method does modify in place the props
 */
export function applyDefaultProps<P>(props: P, ComponentClass: ComponentConstructor<P>) {
  const defaultProps = ComponentClass.defaultProps;
  if (defaultProps) {
    for (let propName in defaultProps) {
      if ((props as any)[propName] === undefined) {
        (props as any)[propName] = defaultProps[propName];
      }
    }
  }
}

//------------------------------------------------------------------------------
// Prop validation helper
//------------------------------------------------------------------------------
function getPropDescription(staticProps: any) {
  if (staticProps instanceof Array) {
    return Object.fromEntries(
      staticProps.map((p) => (p.endsWith("?") ? [p.slice(0, -1), false] : [p, true]))
    );
  }
  return staticProps || { "*": true };
}

/**
 * Validate the component props (or next props) against the (static) props
 * description.  This is potentially an expensive operation: it may needs to
 * visit recursively the props and all the children to check if they are valid.
 * This is why it is only done in 'dev' mode.
 */
export function validateProps<P>(name: string | ComponentConstructor<P>, props: P, parent?: any) {
  const ComponentClass =
    typeof name !== "string"
      ? name
      : (parent.constructor.components[name] as ComponentConstructor<P> | undefined);

  if (!ComponentClass) {
    // this is an error, wrong component. We silently return here instead so the
    // error is triggered by the usual path ('component' function)
    return;
  }
  applyDefaultProps(props, ComponentClass);

  const defaultProps = ComponentClass.defaultProps || {};
  let propsDef = getPropDescription(ComponentClass.props);
  const allowAdditionalProps = "*" in propsDef;

  for (let propName in propsDef) {
    if (propName === "*") {
      continue;
    }
    const propDef = propsDef[propName];
    let isMandatory = !!propDef;
    if (typeof propDef === "object" && "optional" in propDef) {
      isMandatory = !propDef.optional;
    }
    if (isMandatory && propName in defaultProps) {
      throw new Error(
        `A default value cannot be defined for a mandatory prop (name: '${propName}', component: ${ComponentClass.name})`
      );
    }
    if ((props as any)[propName] === undefined) {
      if (isMandatory) {
        throw new Error(`Missing props '${propName}' (component '${ComponentClass.name}')`);
      } else {
        continue;
      }
    }
    let isValid;
    try {
      isValid = isValidProp((props as any)[propName], propDef);
    } catch (e) {
      (e as Error).message = `Invalid prop '${propName}' in component ${ComponentClass.name} (${
        (e as Error).message
      })`;
      throw e;
    }
    if (!isValid) {
      throw new Error(`Invalid Prop '${propName}' in component '${ComponentClass.name}'`);
    }
  }
  if (!allowAdditionalProps) {
    for (let propName in props) {
      if (!(propName in propsDef)) {
        throw new Error(`Unknown prop '${propName}' given to component '${ComponentClass.name}'`);
      }
    }
  }
}

/**
 * Check if an invidual prop value matches its (static) prop definition
 */
function isValidProp(prop: any, propDef: any): boolean {
  if (propDef === true) {
    return true;
  }
  if (typeof propDef === "function") {
    // Check if a value is constructed by some Constructor.  Note that there is a
    // slight abuse of language: we want to consider primitive values as well.
    //
    // So, even though 1 is not an instance of Number, we want to consider that
    // it is valid.
    if (typeof prop === "object") {
      return prop instanceof propDef;
    }
    return typeof prop === propDef.name.toLowerCase();
  } else if (propDef instanceof Array) {
    // If this code is executed, this means that we want to check if a prop
    // matches at least one of its descriptor.
    let result = false;
    for (let i = 0, iLen = propDef.length; i < iLen; i++) {
      result = result || isValidProp(prop, propDef[i]);
    }
    return result;
  }
  // propsDef is an object
  if (propDef.optional && prop === undefined) {
    return true;
  }
  let result = propDef.type ? isValidProp(prop, propDef.type) : true;
  if (propDef.validate) {
    result = result && propDef.validate(prop);
  }
  if (propDef.type === Array && propDef.element) {
    for (let i = 0, iLen = prop.length; i < iLen; i++) {
      result = result && isValidProp(prop[i], propDef.element);
    }
  }
  if (propDef.type === Object && propDef.shape) {
    const shape = propDef.shape;
    for (let key in shape) {
      result = result && isValidProp(prop[key], shape[key]);
    }
    if (result) {
      for (let propName in prop) {
        if (!(propName in shape)) {
          throw new Error(`unknown prop '${propName}'`);
        }
      }
    }
  }
  return result;
}
