import { parseXML } from "../../src/common/utils";
import { compile } from "../../src/compiler";

describe("t-slot", () => {
  test("compile t-props correctly multiple time", () => {
    const template = `<t t-slot="default" t-props="{ a: 1 }"/>`;
    const parsedTemplate = parseXML(template).firstChild as Element;

    const fn1 = compile(parsedTemplate);
    expect(fn1.toString()).toMatchSnapshot();

    const fn2 = compile(parsedTemplate);
    expect(fn2.toString()).toBe(fn1.toString());
  });
});
