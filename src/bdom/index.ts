/**
 * Block DOM
 *
 * A virtual-dom inspired implementation, but where the basic primitive is a
 * "block" instead of just a html (v)node.
 */

import { BCollection } from "./block_collection";
import { BHtml } from "./block_html";
import { BMulti } from "./block_multi";
import { BNode } from "./block_node";
import { BStatic } from "./block_static";
import { BText } from "./block_text";
import { BDispatch } from "./block_dispatch";

export { Block } from "./block";

export const Blocks = {
  BNode,
  BStatic,
  BMulti,
  BHtml,
  BCollection,
  BText,
  BDispatch,
};
