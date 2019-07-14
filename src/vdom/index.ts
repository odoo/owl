import { attrsModule, classModule, eventListenersModule, propsModule } from "./modules";
import { init } from "./vdom";
//------------------------------------------------------------------------------
// patch
//------------------------------------------------------------------------------

export { h, VNode } from "./vdom";

export const patch = init([eventListenersModule, attrsModule, propsModule, classModule]);
