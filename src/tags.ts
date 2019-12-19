import { QWeb } from "./qweb/index";
import { registerSheet } from "./component/styles";

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

/**
 * CSS tag helper for defining inline stylesheets.  With this, one can simply define
 * an inline stylesheet with just the following code:
 * ```js
 *   class A extends Component {
 *     static style = css`.component-a { color: red; }`;
 *   }
 * ```
 */
export function css(strings, ...args) {
  const name = `__sheet__${QWeb.nextId++}`;
  const value = String.raw(strings, ...args);
  registerSheet(name, value);
  return name;
}
