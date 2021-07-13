import { makeTestFixture, renderToBdom, snapshotTemplateCode } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

describe("adding/removing elements", () => {
  test("removing elements", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: ["a"] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>a</span>");
    const bdom2 = renderToBdom(template, { items: [] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("");
  });

  test("removing elements (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: ["a"] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>a</span><span>a</span>");
    const bdom2 = renderToBdom(template, { items: [] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("");
  });

  test("adding one element at the end", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: ["a"] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>a</span>");
    const bdom2 = renderToBdom(template, { items: ["a", "b"] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>a</span><span>b</span>");
  });

  test("adding one element at the end (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: ["a"] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>a</span><span>a</span>");
    const bdom2 = renderToBdom(template, { items: ["a", "b"] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>a</span><span>a</span><span>b</span><span>b</span>");
  });

  test("adding two elements at the end", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span>");
    const span1 = fixture.firstChild;
    expect((span1 as any).outerHTML).toBe("<span>1</span>");
    const bdom2 = renderToBdom(template, { items: [1, 2, 3] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span><span>3</span>");
    const newSpan1 = fixture.firstChild;
    expect(newSpan1).toBe(span1);
  });

  test("adding two elements at the end (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>1</span>");
    const bdom2 = renderToBdom(template, { items: [1, 2, 3] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe(
      "<span>1</span><span>1</span><span>2</span><span>2</span><span>3</span><span>3</span>"
    );
  });

  test("prepend elements: 4,5 => 1,2,3,4,5", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>4</span><span>5</span>");
    const bdom2 = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe(
      "<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>"
    );
  });

  test("prepend elements: 4,5 => 1,2,3,4,5 (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <p t-esc="item"/>
            <p t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<p>4</p><p>4</p><p>5</p><p>5</p>");
    const bdom2 = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );
  });

  test("add element in middle: 1,2,4,5 => 1,2,3,4,5", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span><span>4</span><span>5</span>");
    const bdom2 = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe(
      "<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>"
    );
  });

  test("add element in middle: 1,2,4,5 => 1,2,3,4,5 (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <p t-esc="item"/>
            <p t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );
    const bdom2 = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );
  });

  test("add element at beginning and end: 2,3,4 => 1,2,3,4,5", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [2, 3, 4] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>2</span><span>3</span><span>4</span>");
    const bdom2 = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe(
      "<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>"
    );
  });

  test("add element at beginning and end: 2,3,4 => 1,2,3,4,5 (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <p t-esc="item"/>
            <p t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [2, 3, 4] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p>");
    const bdom2 = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );
  });

  test("adds children: [] => [1,2,3]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("");
    const bdom2 = renderToBdom(template, { items: [1, 2, 3] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span><span>3</span>");
  });

  test("adds children: [] => [1,2,3] (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <p t-esc="item"/>
            <p t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("");
    const bdom2 = renderToBdom(template, { items: [1, 2, 3] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p>");
  });

  test("adds children (inside elem): [] => [1,2,3]", () => {
    const template = `
        <p>
          <t t-foreach="items" t-as="item" t-key="item">
              <span t-esc="item"/>
          </t>
        </p>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<p></p>");
    const bdom2 = renderToBdom(template, { items: [1, 2, 3] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<p><span>1</span><span>2</span><span>3</span></p>");
  });

  test("adds children (inside elem): [] => [1,2,3] (2 nodes)", () => {
    const template = `
        <p>
          <t t-foreach="items" t-as="item" t-key="item">
              <p t-esc="item"/>
              <p t-esc="item"/>
          </t>
        </p>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<p></p>");
    const bdom2 = renderToBdom(template, { items: [1, 2, 3] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<p><p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p></p>");
  });

  test("remove children: [1,2,3] => []", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span><span>3</span>");
    const bdom2 = renderToBdom(template, { items: [] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("");
  });

  test("remove children: [1,2,3] => [] (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <p t-esc="item"/>
            <p t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p>");
    const bdom2 = renderToBdom(template, { items: [] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("");
  });

  test("remove children (inside elem): [1,2,3] => []", () => {
    const template = `
      <p>
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>
      </p>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<p><span>1</span><span>2</span><span>3</span></p>");
    const bdom2 = renderToBdom(template, { items: [] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<p></p>");
  });

  test("remove children from the beginning: [1,2,3,4,5] => [3,4,5]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe(
      "<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>"
    );
    const bdom2 = renderToBdom(template, { items: [3, 4, 5] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>3</span><span>4</span><span>5</span>");
  });

  test("remove children from the beginning: [1,2,3,4,5] => [3,4,5] (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <p t-esc="item"/>
            <p t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );
    const bdom2 = renderToBdom(template, { items: [3, 4, 5] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>");
  });

  test("remove children from the end: [1,2,3,4,5] => [1,2,3]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe(
      "<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>"
    );
    const bdom2 = renderToBdom(template, { items: [1, 2, 3] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span><span>3</span>");
  });

  test("remove children from the middle: [1,2,3,4,5] => [1,2,4,5]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe(
      "<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>"
    );
    const bdom2 = renderToBdom(template, { items: [1, 2, 4, 5] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span><span>4</span><span>5</span>");
  });
});

describe("element reordering", () => {
  test("move element forward: [1,2,3,4] => [2,3,1,4]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3, 4] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span><span>3</span><span>4</span>");
    const bdom2 = renderToBdom(template, { items: [2, 3, 1, 4] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>2</span><span>3</span><span>1</span><span>4</span>");
  });

  test("move element forward: [1,2,3,4] => [2,3,1,4] (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <p t-esc="item"/>
            <p t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3, 4] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p>"
    );
    const bdom2 = renderToBdom(template, { items: [2, 3, 1, 4] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe(
      "<p>2</p><p>2</p><p>3</p><p>3</p><p>1</p><p>1</p><p>4</p><p>4</p>"
    );
  });

  test("move element to end: [1,2,3] => [2,3,1]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span><span>3</span>");
    const bdom2 = renderToBdom(template, { items: [2, 3, 1] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>2</span><span>3</span><span>1</span>");
  });

  test("move element to end: [1,2,3] => [2,3,1] (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <p t-esc="item"/>
            <p t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p>");
    const bdom2 = renderToBdom(template, { items: [2, 3, 1] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<p>2</p><p>2</p><p>3</p><p>3</p><p>1</p><p>1</p>");
  });

  test("move element backward: [1,2,3,4] => [1,4,2,3]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3, 4] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span><span>3</span><span>4</span>");
    const bdom2 = renderToBdom(template, { items: [1, 4, 2, 3] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>4</span><span>2</span><span>3</span>");
  });

  test("swaps first and last: [1,2,3,4] => [4,3,2,1]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3, 4] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>2</span><span>3</span><span>4</span>");
    const bdom2 = renderToBdom(template, { items: [4, 3, 2, 1] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>4</span><span>3</span><span>2</span><span>1</span>");
  });
});

describe("miscellaneous operations", () => {
  test("move to left and replace: [1,2,3,4,5] => [4,1,2,3,6]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe(
      "<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>"
    );
    const bdom2 = renderToBdom(template, { items: [4, 1, 2, 3, 6] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe(
      "<span>4</span><span>1</span><span>2</span><span>3</span><span>6</span>"
    );
  });

  test("move to left and replace: [1,2,3,4,5] => [4,1,2,3,6] (2 nodes)", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <p t-esc="item"/>
            <p t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 2, 3, 4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>4</p><p>4</p><p>5</p><p>5</p>"
    );
    const bdom2 = renderToBdom(template, { items: [4, 1, 2, 3, 6] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe(
      "<p>4</p><p>4</p><p>1</p><p>1</p><p>2</p><p>2</p><p>3</p><p>3</p><p>6</p><p>6</p>"
    );
  });

  test("move to left and leave hole: [1,4,5] => [4,6]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [1, 4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>1</span><span>4</span><span>5</span>");
    const bdom2 = renderToBdom(template, { items: [4, 6] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>4</span><span>6</span>");
  });

  test("[2,4,5] => [4,5,3]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <span t-esc="item"/>
        </t>`;
    snapshotTemplateCode(template);

    const bdom = renderToBdom(template, { items: [2, 4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<span>2</span><span>4</span><span>5</span>");
    const bdom2 = renderToBdom(template, { items: [4, 5, 3] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<span>4</span><span>5</span><span>3</span>");
  });

  test("reverse elements [1,2,3,4,5,6,7,8] => [8,7,6,5,4,3,2,1]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <p t-esc="item"/>
        </t>`;

    const bdom = renderToBdom(template, { items: [1, 2, 3, 4, 5, 6, 7, 8] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe(
      "<p>1</p><p>2</p><p>3</p><p>4</p><p>5</p><p>6</p><p>7</p><p>8</p>"
    );
    const bdom2 = renderToBdom(template, { items: [8, 7, 6, 5, 4, 3, 2, 1] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe(
      "<p>8</p><p>7</p><p>6</p><p>5</p><p>4</p><p>3</p><p>2</p><p>1</p>"
    );
  });

  test("some permutation [0,1,2,3,4,5] => [4,3,2,1,5,0]", () => {
    const template = `
        <t t-foreach="items" t-as="item" t-key="item">
            <p t-esc="item"/>
        </t>`;

    const bdom = renderToBdom(template, { items: [0, 1, 2, 3, 4, 5] });
    bdom.mount(fixture, [], []);
    expect(fixture.innerHTML).toBe("<p>0</p><p>1</p><p>2</p><p>3</p><p>4</p><p>5</p>");
    const bdom2 = renderToBdom(template, { items: [4, 3, 2, 1, 5, 0] });
    bdom.patch(bdom2, [], []);
    expect(fixture.innerHTML).toBe("<p>4</p><p>3</p><p>2</p><p>1</p><p>5</p><p>0</p>");
  });
});
