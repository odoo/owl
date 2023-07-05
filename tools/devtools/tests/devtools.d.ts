import type * as owl from "../../../src/runtime";
import type { JestChrome } from "jest-chrome/types/jest-chrome";
declare global {
  interface Window {
    owl: typeof owl;
    browser: any;
    chrome: JestChrome;
  }
}
