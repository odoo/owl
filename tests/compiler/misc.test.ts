import { snapshotTemplateCode, TestApp, trim } from "../helpers";

// -----------------------------------------------------------------------------
// misc
// -----------------------------------------------------------------------------

describe("misc", () => {
  test("global", () => {
    const app = new TestApp();
    const _calleeAsc = `<año t-att-falló="'agüero'" t-raw="0"/>`;
    const _calleeUsesFoo = `<span t-esc="foo">foo default</span>`;
    const _calleeAscToto = `<div t-raw="toto">toto default</div>`;
    const caller = `
        <div>
          <t t-foreach="[4,5,6]" t-as="value" t-key="value">
            <span t-esc="value"/>
            <t t-call="_callee-asc">
              <t t-call="_callee-uses-foo">
                  <t t-set="foo" t-value="'aaa'"/>
              </t>
              <t t-call="_callee-uses-foo"/>
              <t t-set="foo" t-value="'bbb'"/>
              <t t-call="_callee-uses-foo"/>
            </t>
          </t>
          <t t-call="_callee-asc-toto"/>
        </div>`;
    app.addTemplate("_callee-asc", _calleeAsc);
    app.addTemplate("_callee-uses-foo", _calleeUsesFoo);
    app.addTemplate("_callee-asc-toto", _calleeAscToto);
    app.addTemplate("caller", caller);

    snapshotTemplateCode(caller);
    snapshotTemplateCode(_calleeAscToto);
    snapshotTemplateCode(_calleeAsc);
    snapshotTemplateCode(_calleeUsesFoo);

    const result = trim(app.renderToString("caller"));
    const expected = trim(`
        <div>
          <span>4</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            <span>bbb</span>
          </año>
  
          <span>5</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            <span>bbb</span>
          </año>
  
          <span>6</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            <span>bbb</span>
          </año>
  
          <div>toto default</div>
        </div>
      `);
    expect(result).toBe(expected);
  });
});
