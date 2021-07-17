import { makeTestFixture, renderToBdom, snapshotTemplateCode } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("BMulti", () => {
  test("removing/adding elements", () => {
    const template = `
        <p>1</p>
        <p t-if="flag">2</p>`;

    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { flag: false });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<p>1</p>");

    const bdom2 = renderToBdom(template, { flag: true });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<p>1</p><p>2</p>");

    const bdom3 = renderToBdom(template, { flag: false });
    bdom.patch(bdom3, [], []);
    expect(fixture.innerHTML).toBe("<p>1</p>");

    const bdom4 = renderToBdom(template, { flag: true });
    bdom.patch(bdom4, [], []);
    expect(fixture.innerHTML).toBe("<p>1</p><p>2</p>");
  });

  test("removing an BMulti with an empty slot", () => {
    const template = `
        <p>1</p>
        <p t-if="flag">2</p>`;

    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { flag: false });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<p>1</p>");

    bdom.remove();
    expect(fixture.innerHTML).toBe("");
    expect(fixture.childNodes.length).toBe(0);
  });
});
