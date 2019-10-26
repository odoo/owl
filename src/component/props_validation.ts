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

QWeb.utils.validateProps = function(Widget, props: Object) {
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
          break;
        }
      }
      let isValid = isValidProp(props[propName], propsDef[propName]);
      if (!isValid) {
        throw new Error(`Props '${propName}' of invalid type in component '${Widget.name}'`);
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
 * Check if an invidual prop value matches its (static) prop definition
 */
function isValidProp(prop, propDef): boolean {
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
  let result = isValidProp(prop, propDef.type);
  if (propDef.type === Array) {
    for (let i = 0, iLen = prop.length; i < iLen; i++) {
      result = result && isValidProp(prop[i], propDef.element);
    }
  }
  if (propDef.type === Object) {
    const shape = propDef.shape;
    for (let key in shape) {
      result = result && isValidProp(prop[key], shape[key]);
    }
  }
  return result;
}
