import { batched, EventBus, htmlEscape, markup } from "../src/runtime/utils";
import { nextMicroTick } from "./helpers";

describe("event bus behaviour", () => {
  test("can subscribe and be notified", () => {
    const bus = new EventBus();
    let notified = false;
    bus.addEventListener("event", () => {
      notified = true;
    });
    expect(notified).toBe(false);
    bus.trigger("event");
    expect(notified).toBe(true);
  });

  test("can unsubscribe", () => {
    const bus = new EventBus();
    let n = 0;
    let cb = () => n++;
    bus.addEventListener("event", cb);
    expect(n).toBe(0);
    bus.trigger("event");
    expect(n).toBe(1);
    bus.removeEventListener("event", cb);
    expect(n).toBe(1);
    bus.trigger("event");
    expect(n).toBe(1);
  });

  test("arguments are properly propagated", () => {
    expect.assertions(1);
    const bus = new EventBus();
    bus.addEventListener("event", (ev: any) => expect(ev.detail).toBe("hello world"));
    bus.trigger("event", "hello world");
  });
});

describe("batched", () => {
  test("callback is called only once after operations", async () => {
    let n = 0;
    let fn = batched(() => n++);

    expect(n).toBe(0);
    fn();
    fn();
    expect(n).toBe(0);

    await nextMicroTick();
    expect(n).toBe(1);
    await nextMicroTick();
    expect(n).toBe(1);
  });

  test("calling batched function from within the callback is not treated as part of the original batch", async () => {
    let n = 0;
    let fn = batched(() => {
      n++;
      if (n === 1) {
        fn();
      }
    });

    expect(n).toBe(0);
    fn();
    expect(n).toBe(0);
    await nextMicroTick(); // First batch
    expect(n).toBe(1);
    await nextMicroTick(); // Second batch initiated from within the callback
    expect(n).toBe(2);
    await nextMicroTick();
    expect(n).toBe(2);
  });
});

const Markup = markup("").constructor;
describe("markup", () => {
  test("string is flagged as safe", () => {
    const html = markup("<blink>Hello</blink>");
    expect(html).toBeInstanceOf(Markup);
  });
  describe("htmlEscape", () => {
    test("htmlEscape escapes text", () => {
      const res = htmlEscape("<p>test</p>");
      expect(res.toString()).toBe("&lt;p&gt;test&lt;/p&gt;");
      expect(res).toBeInstanceOf(Markup);
    });
    test("htmlEscape keeps html markup", () => {
      const res = htmlEscape(markup("<p>test</p>"));
      expect(res.toString()).toBe("<p>test</p>");
      expect(res).toBeInstanceOf(Markup);
    });
    test("htmlEscape produces empty string on undefined", () => {
      const res = htmlEscape(undefined);
      expect(res.toString()).toBe("");
      expect(res).toBeInstanceOf(Markup);
    });
    test("htmlEscape produces string from number", () => {
      const res = htmlEscape(10);
      expect(res.toString()).toBe("10");
      expect(res).toBeInstanceOf(Markup);
    });
    test("htmlEscape produces string from boolean", () => {
      const res = htmlEscape(false);
      expect(res.toString()).toBe("false");
      expect(res).toBeInstanceOf(Markup);
    });
    test("htmlEscape correctly escapes various links", () => {
      expect(htmlEscape("<a>this is a link</a>").toString()).toBe(
        "&lt;a&gt;this is a link&lt;/a&gt;"
      );
      expect(htmlEscape(`<a href="https://www.odoo.com">odoo<a>`).toString()).toBe(
        `&lt;a href=&quot;https://www.odoo.com&quot;&gt;odoo&lt;a&gt;`
      );
      expect(htmlEscape(`<a href='https://www.odoo.com'>odoo<a>`).toString()).toBe(
        `&lt;a href=&#x27;https://www.odoo.com&#x27;&gt;odoo&lt;a&gt;`
      );
      expect(htmlEscape("<a href='https://www.odoo.com'>Odoo`s website<a>").toString()).toBe(
        `&lt;a href=&#x27;https://www.odoo.com&#x27;&gt;Odoo&#x60;s website&lt;a&gt;`
      );
    });
    test("htmlEscape doesn't escape already escaped content", () => {
      const res = htmlEscape("<p>test</p>");
      expect(res.toString()).toBe("&lt;p&gt;test&lt;/p&gt;");
      expect(res).toBeInstanceOf(Markup);
      const res2 = htmlEscape(res);
      expect(res2.toString()).toBe("&lt;p&gt;test&lt;/p&gt;");
      expect(res2).toBeInstanceOf(Markup);
      expect(res2).toBe(res);
    });
    test("htmlEscape returns markup even for only-safe text", () => {
      const res = htmlEscape("safe");
      expect(res.toString()).toBe("safe");
      expect(res).toBeInstanceOf(Markup);
    });
  });
  describe("tag function", () => {
    test("interpolated values are escaped", () => {
      const maliciousInput = "<script>alert('💥💥')</script>";
      const html = markup`<b>${maliciousInput}</b>`;
      expect(html.toString()).toBe("<b>&lt;script&gt;alert(&#x27;💥💥&#x27;)&lt;/script&gt;</b>");
      expect(html).toBeInstanceOf(Markup);
    });
    test("interpolated markups aren't escaped", () => {
      const shouldBeEscaped = "<script>alert('should be escaped')</script>";
      const shouldnt = markup("<b>this is safe</b>");
      const html = markup`<div>${shouldBeEscaped} ${shouldnt}</div>`;
      expect(html.toString()).toBe(
        "<div>&lt;script&gt;alert(&#x27;should be escaped&#x27;)&lt;/script&gt; <b>this is safe</b></div>"
      );
      expect(html).toBeInstanceOf(Markup);
    });
    test("quotes in interpolated values are escaped", () => {
      const imgUrl = `lol" onerror="alert('xss')`;
      const html = markup`<img src="${imgUrl}">`;
      expect(html.toString()).toBe(`<img src="lol&quot; onerror=&quot;alert(&#x27;xss&#x27;)">`);
    });
    test("already escaped content is not escaped again", () => {
      const res = htmlEscape("<p>test</p>");
      expect(res.toString()).toBe("&lt;p&gt;test&lt;/p&gt;");
      const html = markup`${res}`;
      expect(html.toString()).toBe("&lt;p&gt;test&lt;/p&gt;");
    });
  });
});
