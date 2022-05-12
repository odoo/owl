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
    let whyInvalid;
    try {
      whyInvalid = whyInvalidProp((props as any)[propName], propDef);
    } catch (e) {
      (e as Error).message = `Invalid prop '${propName}' in component ${ComponentClass.name} (${
        (e as Error).message
      })`;
      throw e;
    }
    if (whyInvalid !== null) {
      whyInvalid = whyInvalid.replace(/\${propName}/g, propName);
      throw new Error(
        `Invalid Prop '${propName}' in component '${ComponentClass.name}': ${whyInvalid}`
      );
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
 * Check why an invidual prop value doesn't match its (static) prop definition
 */
function whyInvalidProp(prop: any, propDef: any): string | null {
  if (propDef === true) {
    return null;
  }
  if (typeof propDef === "function") {
    // Check if a value is constructed by some Constructor.  Note that there is a
    // slight abuse of language: we want to consider primitive values as well.
    //
    // So, even though 1 is not an instance of Number, we want to consider that
    // it is valid.
    if (typeof prop === "object") {
      if (prop instanceof propDef) {
        return null;
      }
      return `\${propName} is not an instance of ${propDef.name}`;
    }
    if (typeof prop === propDef.name.toLowerCase()) {
      return null;
    }
    return `type of \${propName} is not ${propDef.name}`;
  } else if (propDef instanceof Array) {
    // If this code is executed, this means that we want to check if a prop
    // matches at least one of its descriptor.
    let reasons: string[] = [];
    for (let i = 0, iLen = propDef.length; i < iLen; i++) {
      const why = whyInvalidProp(prop, propDef[i]);
      if (why === null) {
        return null;
      }
      reasons.push(why);
    }
    if (reasons.length > 1) {
      return reasons.slice(0, -1).join(", ") + " and " + reasons[reasons.length - 1];
    } else {
      return reasons[0];
    }
  }
  // propsDef is an object
  if (propDef.optional && prop === undefined) {
    return null;
  }
  if (propDef.type) {
    const why = whyInvalidProp(prop, propDef.type);
    if (why !== null) {
      return why;
    }
  }
  if (propDef.validate && !propDef.validate(prop)) {
    return "${propName} could not be validated by `validate` function";
  }
  if (propDef.type === Array && propDef.element) {
    for (let i = 0, iLen = prop.length; i < iLen; i++) {
      const why = whyInvalidProp(prop[i], propDef.element);
      if (why !== null) {
        return why.replace(/\${propName}/g, `\${propName}[${i}]`);
      }
    }
  }
  if (propDef.type === Object && propDef.shape) {
    const shape = propDef.shape;
    for (let key in shape) {
      const why = whyInvalidProp(prop[key], shape[key]);
      if (why !== null) {
        return why.replace(/\${propName}/g, `\${propName}['${key}']`);
      }
    }
    for (let propName in prop) {
      if (!(propName in shape)) {
        return `unknown prop \${propName}['${propName}']`;
      }
    }
  }
  return null;
}
