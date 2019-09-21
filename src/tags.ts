import { QWeb } from "./qweb/index";

/**
 * Owl Tags
 *
 * We have here a (very) small collection of tag functions:
 *
 * - xml
 *
 * The plan is to add a few other tags such as css, globalcss.
 */

/**
 * XML tag helper for defining templates.  With this, one can simply define
 * an inline template with just the template xml:
 * ```js
 *   class A extends Component {
 *     static template = xml`<div>some template</div>`;
 *   }
 * ```
 */
export function xml(strings, ...args) {
  const name = `__template__${QWeb.nextId++}`;
  const value = String.raw(strings, ...args);
  QWeb.registerTemplate(name, value);
  return name;
}
