import { QWeb } from "../qweb/index";

//------------------------------------------------------------------------------
// Prop validation helper
//------------------------------------------------------------------------------

/**
 * Validate the component props (or next props) against the (static) props
 * description.  This is potentially an expensive operation: it may needs to
 * visit recursively the props and all the children to check if they are valid.
 * This is why it is only done in 'dev' mode.
 */

QWeb.utils.validateProps = function (Widget, props: Object) {
  const propsDef = (<any>Widget).props;
  if (propsDef instanceof Array) {
    // list of strings (prop names)
    for (let i = 0, l = propsDef.length; i < l; i++) {
      const propName = propsDef[i];
      if (propName[propName.length - 1] === "?") {
        // optional prop
        break;
      }
      if (!(propName in props)) {
        throw new Error(`Missing props '${propsDef[i]}' (component '${Widget.name}')`);
      }
    }
    for (let key in props) {
      if (!propsDef.includes(key) && !propsDef.includes(key + "?")) {
        throw new Error(`Unknown prop '${key}' given to component '${Widget.name}'`);
      }
    }
  } else if (propsDef) {
    // propsDef is an object now
    for (let propName in propsDef) {
      if (props[propName] === undefined) {
        if (propsDef[propName] && !propsDef[propName].optional) {
          throw new Error(`Missing props '${propName}' (component '${Widget.name}')`);
        } else {
          continue;
        }
      }
      let whyInvalid;
      try {
        whyInvalid = whyInvalidProp(props[propName], propsDef[propName]);
      } catch (e) {
        e.message = `Invalid prop '${propName}' in component ${Widget.name} (${e.message})`;
        throw e;
      }
      if (whyInvalid !== null) {
        whyInvalid = whyInvalid.replace(/\${propName}/g, propName);
        throw new Error(`Invalid Prop '${propName}' in component '${Widget.name}': ${whyInvalid}`);
      }
    }
    for (let propName in props) {
      if (!(propName in propsDef)) {
        throw new Error(`Unknown prop '${propName}' given to component '${Widget.name}'`);
      }
    }
  }
};

/**
 * Check why an invidual prop value doesn't match its (static) prop definition
 */
function whyInvalidProp(prop, propDef): string | null {
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
