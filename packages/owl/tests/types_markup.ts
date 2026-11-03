// Compile-time checks for the values markup() accepts. This file is only
// typechecked (npm run test:types); it is not executed.
import { markup } from "../src";

declare const str: string;
declare const stringObject: String;

// as a tag function, and on a plain string
markup`a ${str} b`;
markup(str);

// a String object is accepted, as the constructor converts it: a Markup passes
// through, and so does a lazily translated term
markup(stringObject);
markup(markup("<b>a</b>"));

// @ts-expect-error a number is not a string
markup(1);
// @ts-expect-error an element is not a string
markup(document.createElement("div"));
