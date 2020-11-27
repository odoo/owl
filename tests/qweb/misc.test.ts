import { snapshotTemplateCode, TestTemplateSet, trim } from "../helpers";

// -----------------------------------------------------------------------------
// misc
// -----------------------------------------------------------------------------

describe("misc", () => {
  test("global", () => {
    const templateSet = new TestTemplateSet();
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
    templateSet.add("_callee-asc", _calleeAsc);
    templateSet.add("_callee-uses-foo", _calleeUsesFoo);
    templateSet.add("_callee-asc-toto", _calleeAscToto);
    templateSet.add("caller", caller);

    snapshotTemplateCode(caller);
    snapshotTemplateCode(_calleeAscToto);
    snapshotTemplateCode(_calleeAsc);
    snapshotTemplateCode(_calleeUsesFoo);

    const result = trim(templateSet.renderToString("caller"));
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
