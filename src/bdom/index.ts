/**
 * Block DOM
 *
 * A virtual-dom inspired implementation, but where the basic primitive is a
 * "block" instead of just a html (v)node.
 */

import { BCollection } from "./b_collection";
import { BHtml } from "./b_html";
import { BMulti } from "./b_multi";
import { BElem } from "./b_elem";
import { BStatic } from "./b_static";
import { BText } from "./b_text";
import { BDispatch } from "./b_dispatch";

export { Block } from "./block";

export const Blocks = {
  BElem,
  BStatic,
  BMulti,
  BHtml,
  BCollection,
  BText,
  BDispatch,
};
