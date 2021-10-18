import { renderToString, snapshotTemplateCode } from "../helpers";

// -----------------------------------------------------------------------------
// debugging
// -----------------------------------------------------------------------------

describe("debugging", () => {
  test("t-debug", () => {
    const consoleLog = console.log;
    console.log = jest.fn();
    const template = `<div t-debug=""><t t-if="true"><span t-debug="">hey</span></t></div>`;
    snapshotTemplateCode(template);
    expect(console.log).toHaveBeenCalledTimes(1);
    console.log = consoleLog;
  });

  test.skip("t-debug on sub template", () => {
    // const consoleLog = console.log;
    // console.log = jest.fn();
    // qweb.addTemplates(`
    //   <templates>
    //   <p t-name="sub" t-debug="">coucou</p>
    //   <div t-name="test">
    //     <t t-call="sub"/>
    //   </div>
    //   </templates>`);
    // qweb.render("test");
    // expect(console.log).toHaveBeenCalledTimes(1);
    // console.log = consoleLog;
  });

  test("t-log", () => {
    const consoleLog = console.log;
    console.log = jest.fn();

    const template = `<div>
            <t t-set="foo" t-value="42"/>
            <t t-log="foo + 3"/>
          </div>`;
    snapshotTemplateCode(template);
    renderToString(template);
    expect(console.log).toHaveBeenCalledWith(45);
    console.log = consoleLog;
  });
});
