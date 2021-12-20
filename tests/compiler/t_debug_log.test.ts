import { renderToString, snapshotTemplate } from "../helpers";

// -----------------------------------------------------------------------------
// debugging
// -----------------------------------------------------------------------------

describe("debugging", () => {
  test("t-debug", () => {
    const consoleLog = console.log;
    console.log = jest.fn();
    const template = `<div t-debug=""><t t-if="true"><span t-debug="">hey</span></t></div>`;
    snapshotTemplate(template);
    expect(console.log).toHaveBeenCalledTimes(1);
    console.log = consoleLog;
  });

  test("t-debug on sub template", () => {
    const consoleLog = console.log;
    console.log = jest.fn();
    let template = `<p t-debug="">coucou</p>`;
    snapshotTemplate(template);
    template = `<div><t t-call="sub"/></div>`;
    snapshotTemplate(template);
    expect(console.log).toHaveBeenCalledTimes(1);
    console.log = consoleLog;
  });

  test("t-log", () => {
    const consoleLog = console.log;
    console.log = jest.fn();

    const template = `<div>
            <t t-set="foo" t-value="42"/>
            <t t-log="foo + 3"/>
          </div>`;
    snapshotTemplate(template);
    renderToString(template);
    expect(console.log).toHaveBeenCalledWith(45);
    console.log = consoleLog;
  });
});
