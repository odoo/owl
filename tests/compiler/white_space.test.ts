import { renderToString, snapshotTemplateCode } from "../helpers";

// -----------------------------------------------------------------------------
// white space
// -----------------------------------------------------------------------------

describe("white space handling", () => {
  test("white space only text nodes are condensed into a single space", () => {
    const template = `<div>  </div>`;
    expect(renderToString(template)).toBe("<div> </div>");
    snapshotTemplateCode(template);
  });

  test("consecutives whitespaces are condensed into a single space", () => {
    const template = `<div>  abc  </div>`;
    expect(renderToString(template)).toBe("<div> abc </div>");
    snapshotTemplateCode(template);
  });

  test("whitespace only text nodes with newlines are removed", () => {
    const template = `<div>
          <span>abc</span>
        </div>`;

    expect(renderToString(template)).toBe("<div><span>abc</span></div>");
    snapshotTemplateCode(template);
  });

  test("nothing is done in pre tags", () => {
    const template1 = `<pre>   </pre>`;
    expect(renderToString(template1)).toBe(template1);

    const template2 = `<pre>
          some text
        </pre>`;
    snapshotTemplateCode(template2);
    expect(renderToString(template2)).toBe(template2);

    const template3 = `<pre>
          
        </pre>`;
    expect(renderToString(template3)).toBe(template3);
  });
});
