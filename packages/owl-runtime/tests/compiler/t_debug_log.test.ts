import { renderToString, snapshotTemplate, getConsoleOutput } from "../helpers";

// -----------------------------------------------------------------------------
// debugging
// -----------------------------------------------------------------------------

describe("debugging", () => {
  test("t-debug", () => {
    const template = `<div t-debug=""><t t-if="true"><span t-debug="">hey</span></t></div>`;
    snapshotTemplate(template);
    expect(getConsoleOutput()).toHaveLength(1);
  });

  test("t-debug on sub template", () => {
    let template = `<p t-debug="">coucou</p>`;
    snapshotTemplate(template);
    template = `<div><t t-call="sub"/></div>`;
    snapshotTemplate(template);
    expect(getConsoleOutput()).toHaveLength(1);
  });

  test("t-log", () => {
    const template = `<div>
            <t t-set="foo" t-value="42"/>
            <t t-log="foo + 3"/>
          </div>`;
    snapshotTemplate(template);
    renderToString(template);
    expect(getConsoleOutput()).toEqual(["log:45"]);
  });

  test("t-log: interaction with t-set", () => {
    const template = `
      <t>
        <t t-log="foo" t-set="foo" t-value="42"/>
        <t t-log="bar" t-set="bar" t-value="49"/>
        <span t-out="foo + bar"/>
      </t>
    `;
    snapshotTemplate(template);
    renderToString(template);
    expect(getConsoleOutput()).toEqual(["log:undefined", "log:undefined"]);
  });

  test("t-debug: interaction with t-set", () => {
    const template = `
      <t>
        <t t-debug="" t-set="foo" t-value="42"/>
        <t t-debug="" t-set="bar" t-value="49"/>
        <span t-out="foo + bar"/>
      </t>
    `;
    snapshotTemplate(template);
    renderToString(template);
  });
});
