import { filterOutModifiersFromData } from "./blockdom/config";
import { STATUS } from "./status";
import { OwlError } from "./error_handling";

export const mainEventHandler = (data: any, ev: Event, currentTarget?: EventTarget | null) => {
  const { data: _data, modifiers } = filterOutModifiersFromData(data);
  data = _data;
  let stopped = false;
  if (modifiers.length) {
    let selfMode = false;
    const isSelf = ev.target === currentTarget;
    for (const mod of modifiers) {
      switch (mod) {
        case "self":
          selfMode = true;
          if (isSelf) {
            continue;
          } else {
            return stopped;
          }
        case "prevent":
          if ((selfMode && isSelf) || !selfMode) ev.preventDefault();
          continue;
        case "stop":
          if ((selfMode && isSelf) || !selfMode) ev.stopPropagation();
          stopped = true;
          continue;
      }
    }
  }
  // If handler is empty, the array slot 0 will also be empty, and data will not have the property 0
  // We check this rather than data[0] being truthy (or typeof function) so that it crashes
  // as expected when there is a handler expression that evaluates to a falsy value
  if (Object.hasOwnProperty.call(data, 0)) {
    const handler = data[0];
    if (typeof handler !== "function") {
      throw new OwlError(`Invalid handler (expected a function, received: '${handler}')`);
    }
    let node = data[1] ? data[1].__owl__ : null;
    if (node ? node.status === STATUS.MOUNTED : true) {
      handler.call(node ? node.component : null, ev);
    }
  }
  return stopped;
};
