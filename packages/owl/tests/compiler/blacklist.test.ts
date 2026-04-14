import { renderToString } from "../helpers";

describe("blacklisted tags and attributes", () => {
  test("template with block-text tag", () => {
    const template = `<div><block-text-0/>hello</div>`;
    expect(() => renderToString(template)).toThrow("Invalid tag name: 'block-text-0'");
  });

  test("template with block-handler tag", () => {
    const template = `<div block-handler-0="click">hello</div>`;
    expect(() => renderToString(template)).toThrow("Invalid attribute: 'block-handler-0'");
  });
});
