import { parseXML } from "../../src/common/utils";
import { compile } from "../../src/compiler";

describe("t-call-slot", () => {
  test("compile t-props correctly multiple time", () => {
    const template = `<t t-call-slot="default" t-props="{ a: 1 }"/>`;
    const parsedTemplate = parseXML(template).firstChild as Element;

    const fn1 = compile(parsedTemplate);
    expect(fn1.toString()).toMatchSnapshot();

    const fn2 = compile(parsedTemplate);
    expect(fn2.toString()).toBe(fn1.toString());
  });

  test("warn on t-slot", () => {
    const template = `<t t-slot="default"/>`;
    const parsedTemplate = parseXML(template).firstChild as Element;
    const originalConsoleWarn = console.warn;
    const mockConsoleWarn = jest.fn(() => {});
    console.warn = mockConsoleWarn;
    compile(parsedTemplate);
    console.warn = originalConsoleWarn;
    expect(mockConsoleWarn).toHaveBeenCalledWith("t-slot has been renamed t-call-slot.");
  });
});
