import { h, patch } from "../src/vdom";
import { htmlToVDOM } from "../src/vdom/html_to_vdom";
import { init, addNS } from "../src/vdom/vdom";

function map(list, fn) {
  var ret: any[] = [];
  for (var i = 0; i < list.length; ++i) {
    ret[i] = fn(list[i]);
  }
  return ret;
}

//------------------------------------------------------------------------------
// Attributes
//------------------------------------------------------------------------------
describe("attributes", function () {
  let elm, vnode0;
  beforeEach(function () {
    elm = document.createElement("div");
    vnode0 = elm;
  });

  test("have their provided values", function () {
    const vnode1 = h("div", {
      attrs: { href: "/foo", minlength: 1, selected: true, disabled: false },
    });
    elm = patch(vnode0, vnode1).elm;

    expect(elm.getAttribute("href")).toBe("/foo");
    expect(elm.getAttribute("minlength")).toBe("1");
    expect(elm.hasAttribute("selected")).toBe(true);
    expect(elm.getAttribute("selected")).toBe("");
    expect(elm.hasAttribute("disabled")).toBe(false);
  });

  test("can be memoized", function () {
    const cachedAttrs = { href: "/foo", minlength: 1, selected: true };
    const vnode1 = h("div", { attrs: cachedAttrs });
    const vnode2 = h("div", { attrs: cachedAttrs });
    elm = patch(vnode0, vnode1).elm;
    expect(elm.getAttribute("href")).toBe("/foo");
    expect(elm.getAttribute("minlength")).toBe("1");
    expect(elm.getAttribute("selected")).toBe("");
    elm = patch(vnode1, vnode2).elm;
    expect(elm.getAttribute("href")).toBe("/foo");
    expect(elm.getAttribute("minlength")).toBe("1");
    expect(elm.getAttribute("selected")).toBe("");
  });

  test("are not omitted when falsy values are provided", function () {
    const vnode1 = h("div", <any>{
      attrs: { href: null, minlength: 0, value: "", title: "undefined" },
    });
    elm = patch(vnode0, vnode1).elm;
    expect(elm.getAttribute("href")).toBe("null");
    expect(elm.getAttribute("minlength")).toBe("0");
    expect(elm.getAttribute("value")).toBe("");
    expect(elm.getAttribute("title")).toBe("undefined");
  });

  test("are set correctly when namespaced", function () {
    const vnode1 = h("div", { attrs: { "xlink:href": "#foo" } });
    elm = patch(vnode0, vnode1).elm;
    expect(elm.getAttributeNS("http://www.w3.org/1999/xlink", "href")).toBe("#foo");
  });

  test("should not touch class nor id fields", function () {
    elm = document.createElement("div");
    elm.id = "myId";
    elm.className = "myClass";
    vnode0 = elm;
    const vnode1 = h("div#myId.myClass", { attrs: {} }, ["Hello"]);
    elm = patch(vnode0, vnode1).elm;
    expect(elm.tagName).toBe("DIV");
    expect(elm.id).toBe("myId");
    expect(elm.className).toBe("myClass");
    expect(elm.textContent).toBe("Hello");
  });

  describe("boolean attribute", function () {
    test("is present and empty string if the value is truthy", function () {
      const vnode1 = h("div", {
        attrs: { required: true, readonly: 1, noresize: "truthy" },
      });
      elm = patch(vnode0, vnode1).elm;
      expect(elm.hasAttribute("required")).toBe(true);
      expect(elm.getAttribute("required")).toBe("");
      expect(elm.hasAttribute("readonly")).toBe(true);
      expect(elm.getAttribute("readonly")).toBe("1");
      expect(elm.hasAttribute("noresize")).toBe(true);
      expect(elm.getAttribute("noresize")).toBe("truthy");
    });

    test("is omitted if the value is false", function () {
      const vnode1 = h("div", { attrs: { required: false } });
      elm = patch(vnode0, vnode1).elm;
      expect(elm.hasAttribute("required")).toBe(false);
      expect(elm.getAttribute("required")).toBe(null);
    });

    test("is not omitted if the value is falsy but casted to string", function () {
      const vnode1 = h("div", <any>{ attrs: { readonly: 0, noresize: null } });
      elm = patch(vnode0, vnode1).elm;
      expect(elm.getAttribute("readonly")).toBe("0");
      expect(elm.getAttribute("noresize")).toBe("null");
    });
  });

  describe("Object.prototype property", function () {
    test("is not considered as a boolean attribute and shouldn't be omitted", function () {
      const vnode1 = h("div", { attrs: { constructor: true } });
      elm = patch(vnode0, vnode1).elm;
      expect(elm.hasAttribute("constructor")).toBe(true);
      expect(elm.getAttribute("constructor")).toBe("");
      const vnode2 = h("div", { attrs: { constructor: false } });
      elm = patch(vnode0, vnode2).elm;
      expect(elm.hasAttribute("constructor")).toBe(false);
    });
  });
});

//------------------------------------------------------------------------------
// Hyperscript
//------------------------------------------------------------------------------
describe("hyperscript", function () {
  test("can create vnode with proper tag", function () {
    expect(h("div").sel).toBe("div");
    expect(h("a").sel).toBe("a");
  });

  test("can create vnode with children", function () {
    const vnode = h("div", [h("span#hello"), h("b.world")]);
    expect(vnode.sel).toBe("div");
    expect((<any>vnode).children[0].sel).toBe("span#hello");
    expect((<any>vnode).children[1].sel).toBe("b.world");
  });

  test("can create vnode with one child vnode", function () {
    const vnode = h("div", h("span#hello"));
    expect(vnode.sel).toBe("div");
    expect((<any>vnode).children[0].sel).toBe("span#hello");
  });

  test("can create vnode with props and one child vnode", function () {
    const vnode = h("div", {}, h("span#hello"));
    expect(vnode.sel).toBe("div");
    expect((<any>vnode).children[0].sel).toBe("span#hello");
  });

  test("can create vnode with text content", function () {
    const vnode = h("a", ["I am a string"]);
    expect((<any>vnode).children[0].text).toBe("I am a string");
  });

  test("can create vnode with text content in string", function () {
    const vnode = h("a", "I am a string");
    expect(vnode.text).toBe("I am a string");
  });

  test("can create vnode with props and text content in string", function () {
    const vnode = h("a", {}, "I am a string");
    expect(vnode.text).toBe("I am a string");
  });

  test("can create vnode for comment", function () {
    const vnode = h("!", "test");
    expect(vnode.sel).toBe("!");
    expect(vnode.text).toBe("test");
  });
});

//------------------------------------------------------------------------------
// VDOM
//------------------------------------------------------------------------------
describe("snabbdom", function () {
  let elm: any, vnode0;
  beforeEach(function () {
    elm = document.createElement("div");
    vnode0 = elm;
  });

  describe("created element", function () {
    test("has tag", function () {
      elm = patch(vnode0, h("div")).elm;
      expect(elm.tagName).toBe("DIV");
    });

    test("has correct namespace", function () {
      const SVGNamespace = "http://www.w3.org/2000/svg";
      const XHTMLNamespace = "http://www.w3.org/1999/xhtml";

      elm = patch(vnode0, h("div", [h("div", { ns: SVGNamespace })])).elm;
      expect(elm.firstChild.namespaceURI).toBe(SVGNamespace);

      // verify that svg tag automatically gets svg namespace
      const vnode = h("svg", [h("foreignObject", [h("div", ["I am HTML embedded in SVG"])])]);
      // need to add namespace manually. it is usually done by the template
      // compiler
      addNS(vnode.data, (vnode as any).children, vnode.sel);

      elm = patch(vnode0, vnode).elm;
      expect(elm.namespaceURI).toBe(SVGNamespace);
      expect(elm.firstChild.namespaceURI).toBe(SVGNamespace);
      expect(elm.firstChild.firstChild.namespaceURI).toBe(XHTMLNamespace);
    });

    test("can create elements with text content", function () {
      elm = patch(vnode0, h("div", ["I am a string"])).elm;
      expect(elm.innerHTML).toBe("I am a string");
    });

    test("can create elements with span and text content", function () {
      elm = patch(vnode0, h("a", [h("span"), "I am a string"])).elm;
      expect(elm.childNodes[0].tagName).toBe("SPAN");
      expect(elm.childNodes[1].textContent).toBe("I am a string");
    });

    test("can create elements with props", function () {
      elm = patch(vnode0, h("a", { props: { src: "http://localhost/" } })).elm;
      expect(elm.src).toBe("http://localhost/");
    });

    test("is a patch of the root element", function () {
      const elmWithIdAndClass = document.createElement("div");
      elmWithIdAndClass.id = "id";
      elmWithIdAndClass.className = "class";
      const vnode1 = h("div#id.class", [h("span", "Hi")]);
      elm = patch(elmWithIdAndClass, vnode1).elm;
      expect(elm).toBe(elmWithIdAndClass);
      expect(elm.tagName).toBe("DIV");
      expect(elm.id).toBe("id");
      expect(elm.className).toBe("class");
    });

    test("can create comments", function () {
      elm = patch(vnode0, h("!", "test")).elm;
      expect(elm.nodeType).toBe(document.COMMENT_NODE);
      expect(elm.textContent).toBe("test");
    });
  });

  describe("patching an element", function () {
    test("changes an elements props", function () {
      const vnode1 = h("a", { props: { src: "http://other/" } });
      const vnode2 = h("a", { props: { src: "http://localhost/" } });
      patch(vnode0, vnode1);
      elm = patch(vnode1, vnode2).elm;
      expect(elm.src).toBe("http://localhost/");
    });

    test("preserves memoized props", function () {
      const cachedProps = { src: "http://other/" };
      const vnode1 = h("a", { props: cachedProps });
      const vnode2 = h("a", { props: cachedProps });
      elm = patch(vnode0, vnode1).elm;
      expect(elm.src).toBe("http://other/");
      elm = patch(vnode1, vnode2).elm;
      expect(elm.src).toBe("http://other/");
    });

    test("removes an elements props", function () {
      const vnode1 = h("a", { props: { src: "http://other/" } });
      const vnode2 = h("a");
      patch(vnode0, vnode1);
      patch(vnode1, vnode2);
      expect(elm.src).toBeUndefined();
    });
  });

  describe("updating children with keys", function () {
    function spanNum(n) {
      if (n == null) {
        return n;
      } else if (typeof n === "string") {
        return h("span", {}, n);
      } else {
        return h("span", { key: n }, n.toString());
      }
    }

    describe("addition of elements", function () {
      test("appends elements", function () {
        const vnode1 = h("span", [1].map(spanNum));
        const vnode2 = h("span", [1, 2, 3].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(1);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children.length).toBe(3);
        expect(elm.children[1].innerHTML).toBe("2");
        expect(elm.children[2].innerHTML).toBe("3");
      });

      test("prepends elements", function () {
        const vnode1 = h("span", [4, 5].map(spanNum));
        const vnode2 = h("span", [1, 2, 3, 4, 5].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(2);
        elm = patch(vnode1, vnode2).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["1", "2", "3", "4", "5"]);
      });

      test("add elements in the middle", function () {
        const vnode1 = h("span", [1, 2, 4, 5].map(spanNum));
        const vnode2 = h("span", [1, 2, 3, 4, 5].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(4);
        expect(elm.children.length).toBe(4);
        elm = patch(vnode1, vnode2).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["1", "2", "3", "4", "5"]);
      });

      test("add elements at beginning and end", function () {
        const vnode1 = h("span", [2, 3, 4].map(spanNum));
        const vnode2 = h("span", [1, 2, 3, 4, 5].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(3);
        elm = patch(vnode1, vnode2).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["1", "2", "3", "4", "5"]);
      });

      test("adds children to parent with no children", function () {
        const vnode1 = h("span", { key: "span" });
        const vnode2 = h("span", { key: "span" }, [1, 2, 3].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(0);
        elm = patch(vnode1, vnode2).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["1", "2", "3"]);
      });

      test("removes all children from parent", function () {
        const vnode1 = h("span", { key: "span" }, [1, 2, 3].map(spanNum));
        const vnode2 = h("span", { key: "span" });
        elm = patch(vnode0, vnode1).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["1", "2", "3"]);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children.length).toBe(0);
      });

      test("update one child with same key but different sel", function () {
        const vnode1 = h("span", { key: "span" }, [1, 2, 3].map(spanNum));
        const vnode2 = h("span", { key: "span" }, [
          spanNum(1),
          h("i", { key: 2 }, "2"),
          spanNum(3),
        ]);
        elm = patch(vnode0, vnode1).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["1", "2", "3"]);
        elm = patch(vnode1, vnode2).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["1", "2", "3"]);
        expect(elm.children.length).toBe(3);
        expect(elm.children[1].tagName).toBe("I");
      });
    });

    describe("removal of elements", function () {
      test("removes elements from the beginning", function () {
        const vnode1 = h("span", [1, 2, 3, 4, 5].map(spanNum));
        const vnode2 = h("span", [3, 4, 5].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(5);
        elm = patch(vnode1, vnode2).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["3", "4", "5"]);
      });

      test("removes elements from the end", function () {
        const vnode1 = h("span", [1, 2, 3, 4, 5].map(spanNum));
        const vnode2 = h("span", [1, 2, 3].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(5);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children.length).toBe(3);
        expect(elm.children[0].innerHTML).toBe("1");
        expect(elm.children[1].innerHTML).toBe("2");
        expect(elm.children[2].innerHTML).toBe("3");
      });

      test("removes elements from the middle", function () {
        const vnode1 = h("span", [1, 2, 3, 4, 5].map(spanNum));
        const vnode2 = h("span", [1, 2, 4, 5].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(5);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children.length).toBe(4);
        expect(elm.children[0].innerHTML).toBe("1");
        expect(elm.children[1].innerHTML).toBe("2");
        expect(elm.children[2].innerHTML).toBe("4");
        expect(elm.children[3].innerHTML).toBe("5");
      });
    });

    describe("element reordering", function () {
      test("moves element forward", function () {
        const vnode1 = h("span", [1, 2, 3, 4].map(spanNum));
        const vnode2 = h("span", [2, 3, 1, 4].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(4);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children.length).toBe(4);
        expect(elm.children[0].innerHTML).toBe("2");
        expect(elm.children[1].innerHTML).toBe("3");
        expect(elm.children[2].innerHTML).toBe("1");
        expect(elm.children[3].innerHTML).toBe("4");
      });

      test("moves element to end", function () {
        const vnode1 = h("span", [1, 2, 3].map(spanNum));
        const vnode2 = h("span", [2, 3, 1].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(3);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children.length).toBe(3);
        expect(elm.children[0].innerHTML).toBe("2");
        expect(elm.children[1].innerHTML).toBe("3");
        expect(elm.children[2].innerHTML).toBe("1");
      });

      test("moves element backwards", function () {
        const vnode1 = h("span", [1, 2, 3, 4].map(spanNum));
        const vnode2 = h("span", [1, 4, 2, 3].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(4);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children.length).toBe(4);
        expect(elm.children[0].innerHTML).toBe("1");
        expect(elm.children[1].innerHTML).toBe("4");
        expect(elm.children[2].innerHTML).toBe("2");
        expect(elm.children[3].innerHTML).toBe("3");
      });

      test("swaps first and last", function () {
        const vnode1 = h("span", [1, 2, 3, 4].map(spanNum));
        const vnode2 = h("span", [4, 2, 3, 1].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(4);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children.length).toBe(4);
        expect(elm.children[0].innerHTML).toBe("4");
        expect(elm.children[1].innerHTML).toBe("2");
        expect(elm.children[2].innerHTML).toBe("3");
        expect(elm.children[3].innerHTML).toBe("1");
      });
    });

    describe("combinations of additions, removals and reorderings", function () {
      test("move to left and replace", function () {
        const vnode1 = h("span", [1, 2, 3, 4, 5].map(spanNum));
        const vnode2 = h("span", [4, 1, 2, 3, 6].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(5);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children.length).toBe(5);
        expect(elm.children[0].innerHTML).toBe("4");
        expect(elm.children[1].innerHTML).toBe("1");
        expect(elm.children[2].innerHTML).toBe("2");
        expect(elm.children[3].innerHTML).toBe("3");
        expect(elm.children[4].innerHTML).toBe("6");
      });

      test("moves to left and leaves hole", function () {
        const vnode1 = h("span", [1, 4, 5].map(spanNum));
        const vnode2 = h("span", [4, 6].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(3);
        elm = patch(vnode1, vnode2).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["4", "6"]);
      });

      test("handles moved and set to undefined element ending at the end", function () {
        const vnode1 = h("span", [2, 4, 5].map(spanNum));
        const vnode2 = h("span", [4, 5, 3].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(3);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children.length).toBe(3);
        expect(elm.children[0].innerHTML).toBe("4");
        expect(elm.children[1].innerHTML).toBe("5");
        expect(elm.children[2].innerHTML).toBe("3");
      });

      test("moves a key in non-keyed nodes with a size up", function () {
        const vnode1 = h("span", [1, "a", "b", "c"].map(spanNum));
        const vnode2 = h("span", ["d", "a", "b", "c", 1, "e"].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(4);
        expect(elm.textContent).toBe("1abc");
        elm = patch(vnode1, vnode2).elm;
        expect(elm.childNodes.length).toBe(6);
        expect(elm.textContent).toBe("dabc1e");
      });
    });

    describe("misc", function () {
      test("reverses elements", function () {
        const vnode1 = h("span", [1, 2, 3, 4, 5, 6, 7, 8].map(spanNum));
        const vnode2 = h("span", [8, 7, 6, 5, 4, 3, 2, 1].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(8);
        elm = patch(vnode1, vnode2).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual([
          "8",
          "7",
          "6",
          "5",
          "4",
          "3",
          "2",
          "1",
        ]);
      });

      test("something", function () {
        const vnode1 = h("span", [0, 1, 2, 3, 4, 5].map(spanNum));
        const vnode2 = h("span", [4, 3, 2, 1, 5, 0].map(spanNum));
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(6);
        elm = patch(vnode1, vnode2).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["4", "3", "2", "1", "5", "0"]);
      });

      test("supports null/undefined children", function () {
        const vnode1 = h("i", [0, 1, 2, 3, 4, 5].map(spanNum));
        const vnode2 = h(
          "i",
          [null, 2, undefined, null, 1, 0, null, 5, 4, null, 3, undefined].map(spanNum)
        );
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children.length).toBe(6);
        elm = patch(vnode1, vnode2).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["2", "1", "0", "5", "4", "3"]);
      });

      test("supports all null/undefined children", function () {
        const vnode1 = h("i", [0, 1, 2, 3, 4, 5].map(spanNum));
        const vnode2 = h("i", [null, null, undefined, null, null, undefined]);
        const vnode3 = h("i", [5, 4, 3, 2, 1, 0].map(spanNum));
        patch(vnode0, vnode1);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children.length).toBe(0);
        elm = patch(vnode2, vnode3).elm;
        expect(map(elm.children, (c) => c.innerHTML)).toEqual(["5", "4", "3", "2", "1", "0"]);
      });
    });
  });

  describe("updating children without keys", function () {
    test("appends elements", function () {
      const vnode1 = h("div", [h("span", "Hello")]);
      const vnode2 = h("div", [h("span", "Hello"), h("span", "World")]);
      elm = patch(vnode0, vnode1).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["Hello"]);
      elm = patch(vnode1, vnode2).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["Hello", "World"]);
    });

    test("handles unmoved text nodes", function () {
      const vnode1 = h("div", ["Text", h("span", "Span")]);
      const vnode2 = h("div", ["Text", h("span", "Span")]);
      elm = patch(vnode0, vnode1).elm;
      expect(elm.childNodes[0].textContent).toBe("Text");
      elm = patch(vnode1, vnode2).elm;
      expect(elm.childNodes[0].textContent).toBe("Text");
    });

    test("handles changing text children", function () {
      const vnode1 = h("div", ["Text", h("span", "Span")]);
      const vnode2 = h("div", ["Text2", h("span", "Span")]);
      elm = patch(vnode0, vnode1).elm;
      expect(elm.childNodes[0].textContent).toBe("Text");
      elm = patch(vnode1, vnode2).elm;
      expect(elm.childNodes[0].textContent).toBe("Text2");
    });

    test("handles unmoved comment nodes", function () {
      const vnode1 = h("div", [h("!", "Text"), h("span", "Span")]);
      const vnode2 = h("div", [h("!", "Text"), h("span", "Span")]);
      elm = patch(vnode0, vnode1).elm;
      expect(elm.childNodes[0].textContent).toBe("Text");
      elm = patch(vnode1, vnode2).elm;
      expect(elm.childNodes[0].textContent).toBe("Text");
    });

    test("handles changing comment text", function () {
      const vnode1 = h("div", [h("!", "Text"), h("span", "Span")]);
      const vnode2 = h("div", [h("!", "Text2"), h("span", "Span")]);
      elm = patch(vnode0, vnode1).elm;
      expect(elm.childNodes[0].textContent).toBe("Text");
      elm = patch(vnode1, vnode2).elm;
      expect(elm.childNodes[0].textContent).toBe("Text2");
    });

    test("handles changing empty comment", function () {
      const vnode1 = h("div", [h("!"), h("span", "Span")]);
      const vnode2 = h("div", [h("!", "Test"), h("span", "Span")]);
      elm = patch(vnode0, vnode1).elm;
      expect(elm.childNodes[0].textContent).toBe("");
      elm = patch(vnode1, vnode2).elm;
      expect(elm.childNodes[0].textContent).toBe("Test");
    });

    test("prepends element", function () {
      const vnode1 = h("div", [h("span", "World")]);
      const vnode2 = h("div", [h("span", "Hello"), h("span", "World")]);
      elm = patch(vnode0, vnode1).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["World"]);
      elm = patch(vnode1, vnode2).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["Hello", "World"]);
    });

    test("prepends element of different tag type", function () {
      const vnode1 = h("div", [h("span", "World")]);
      const vnode2 = h("div", [h("div", "Hello"), h("span", "World")]);
      elm = patch(vnode0, vnode1).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["World"]);
      elm = patch(vnode1, vnode2).elm;
      expect(map(elm.children, (c) => c.tagName)).toEqual(["DIV", "SPAN"]);
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["Hello", "World"]);
    });

    test("removes elements", function () {
      const vnode1 = h("div", [h("span", "One"), h("span", "Two"), h("span", "Three")]);
      const vnode2 = h("div", [h("span", "One"), h("span", "Three")]);
      elm = patch(vnode0, vnode1).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["One", "Two", "Three"]);
      elm = patch(vnode1, vnode2).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["One", "Three"]);
    });

    test("removes a single text node", function () {
      const vnode1 = h("div", "One");
      const vnode2 = h("div");
      patch(vnode0, vnode1);
      expect(elm.textContent).toBe("One");
      patch(vnode1, vnode2);
      expect(elm.textContent).toBe("");
    });

    test("removes a single text node when children are updated", function () {
      const vnode1 = h("div", "One");
      const vnode2 = h("div", [h("div", "Two"), h("span", "Three")]);
      patch(vnode0, vnode1);
      expect(elm.textContent).toBe("One");
      patch(vnode1, vnode2);
      expect(map(elm.children, (c) => c.textContent)).toEqual(["Two", "Three"]);
    });

    test("removes a text node among other elements", function () {
      const vnode1 = h("div", ["One", h("span", "Two")]);
      const vnode2 = h("div", [h("div", "Three")]);
      patch(vnode0, vnode1);
      expect(map(elm.childNodes, (c) => c.textContent)).toEqual(["One", "Two"]);
      patch(vnode1, vnode2);
      expect(elm.childNodes.length).toBe(1);
      expect(elm.childNodes[0].tagName).toBe("DIV");
      expect(elm.childNodes[0].textContent).toBe("Three");
    });

    test("reorders elements", function () {
      const vnode1 = h("div", [h("span", "One"), h("div", "Two"), h("b", "Three")]);
      const vnode2 = h("div", [h("b", "Three"), h("span", "One"), h("div", "Two")]);
      elm = patch(vnode0, vnode1).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["One", "Two", "Three"]);
      elm = patch(vnode1, vnode2).elm;
      expect(map(elm.children, (c) => c.tagName)).toEqual(["B", "SPAN", "DIV"]);
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["Three", "One", "Two"]);
    });

    test("supports null/undefined children", function () {
      const vnode1 = h("i", [null, h("i", "1"), h("i", "2"), null]);
      const vnode2 = h("i", [h("i", "2"), undefined, undefined, h("i", "1"), undefined]);
      const vnode3 = h("i", [null, h("i", "1"), undefined, null, h("i", "2"), undefined, null]);
      elm = patch(vnode0, vnode1).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["1", "2"]);
      elm = patch(vnode1, vnode2).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["2", "1"]);
      elm = patch(vnode2, vnode3).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["1", "2"]);
    });

    test("supports all null/undefined children", function () {
      const vnode1 = h("i", [h("i", "1"), h("i", "2")]);
      const vnode2 = h("i", [null, undefined]);
      const vnode3 = h("i", [h("i", "2"), h("i", "1")]);
      patch(vnode0, vnode1);
      elm = patch(vnode1, vnode2).elm;
      expect(elm.children.length).toBe(0);
      elm = patch(vnode2, vnode3).elm;
      expect(map(elm.children, (c) => c.innerHTML)).toEqual(["2", "1"]);
    });
  });

  describe("hooks", function () {
    describe("element hooks", function () {
      test("calls `create` listener before inserted into parent but after children", function () {
        const result: any[] = [];
        function cb(empty, vnode) {
          expect(vnode.elm).toBeInstanceOf(Element);
          expect(vnode.elm.children).toHaveLength(2);
          expect(vnode.elm.parentNode).toBeNull();
          result.push(vnode);
        }
        const vnode1 = h("div", [
          h("span", "First sibling"),
          h("div", { hook: { create: cb } }, [h("span", "Child 1"), h("span", "Child 2")]),
          h("span", "Can't touch me"),
        ]);
        patch(vnode0, vnode1);
        expect(result).toHaveLength(1);
      });

      test("calls `insert` listener after both parents, siblings and children have been inserted", function () {
        const result: any[] = [];
        function cb(vnode) {
          expect(vnode.elm).toBeInstanceOf(Element);
          expect(vnode.elm.children).toHaveLength(2);
          expect(vnode.elm.parentNode.children).toHaveLength(3);
          result.push(vnode);
        }
        const vnode1 = h("div", [
          h("span", "First sibling"),
          h("div", { hook: { insert: cb } }, [h("span", "Child 1"), h("span", "Child 2")]),
          h("span", "Can touch me"),
        ]);
        patch(vnode0, vnode1);
        expect(result).toHaveLength(1);
      });

      test("calls `prepatch` listener", function () {
        const result: any[] = [];
        function cb(oldVnode, vnode) {
          expect(oldVnode).toBe(vnode1.children![1]);
          expect(vnode).toBe(vnode2.children![1]);
          result.push(vnode);
        }
        const vnode1 = h("div", [
          h("span", "First sibling"),
          h("div", { hook: { prepatch: cb } }, [h("span", "Child 1"), h("span", "Child 2")]),
        ]);
        const vnode2 = h("div", [
          h("span", "First sibling"),
          h("div", { hook: { prepatch: cb } }, [h("span", "Child 1"), h("span", "Child 2")]),
        ]);
        patch(vnode0, vnode1);
        patch(vnode1, vnode2);
        expect(result).toHaveLength(1);
      });

      test("calls `postpatch` after `prepatch` listener", function () {
        const pre: any[] = [],
          post: any[] = [];
        function preCb(oldVnode, vnode) {
          pre.push(pre);
        }
        function postCb(oldVnode, vnode) {
          expect(pre.length).toBe(post.length + 1);
          post.push(post);
        }
        const vnode1 = h("div", [
          h("span", "First sibling"),
          h("div", { hook: { prepatch: preCb, postpatch: postCb } }, [
            h("span", "Child 1"),
            h("span", "Child 2"),
          ]),
        ]);
        const vnode2 = h("div", [
          h("span", "First sibling"),
          h("div", { hook: { prepatch: preCb, postpatch: postCb } }, [
            h("span", "Child 1"),
            h("span", "Child 2"),
          ]),
        ]);
        patch(vnode0, vnode1);
        patch(vnode1, vnode2);
        expect(pre).toHaveLength(1);
        expect(post).toHaveLength(1);
      });

      test("calls `update` listener", function () {
        const result1: any[] = [];
        const result2: any[] = [];
        function cb(result, oldVnode, vnode) {
          if (result.length > 0) {
            console.log(result[result.length - 1]);
            console.log(oldVnode);
            expect(result[result.length - 1]).toBe(oldVnode);
          }
          result.push(vnode);
        }
        const vnode1 = h("div", [
          h("span", "First sibling"),
          h("div", { hook: { update: cb.bind(null, result1) } }, [
            h("span", "Child 1"),
            h("span", { hook: { update: cb.bind(null, result2) } }, "Child 2"),
          ]),
        ]);
        const vnode2 = h("div", [
          h("span", "First sibling"),
          h("div", { hook: { update: cb.bind(null, result1) } }, [
            h("span", "Child 1"),
            h("span", { hook: { update: cb.bind(null, result2) } }, "Child 2"),
          ]),
        ]);
        patch(vnode0, vnode1);
        patch(vnode1, vnode2);
        expect(result1).toHaveLength(1);
        expect(result2).toHaveLength(1);
      });

      test("calls `remove` listener", function () {
        const result: any[] = [];
        function cb(vnode, rm) {
          const parent = vnode.elm.parentNode;
          expect(vnode.elm).toBeInstanceOf(Element);
          expect(vnode.elm.children).toHaveLength(2);
          expect(parent.children).toHaveLength(2);
          result.push(vnode);
          rm();
          expect(parent.children).toHaveLength(1);
        }
        const vnode1 = h("div", [
          h("span", "First sibling"),
          h("div", { hook: { remove: cb } }, [h("span", "Child 1"), h("span", "Child 2")]),
        ]);
        const vnode2 = h("div", [h("span", "First sibling")]);
        patch(vnode0, vnode1);
        patch(vnode1, vnode2);
        expect(result).toHaveLength(1);
      });

      test("calls `destroy` listener when patching text node over node with children", function () {
        let calls = 0;
        function cb(vnode) {
          calls++;
        }
        const vnode1 = h("div", [h("div", { hook: { destroy: cb } }, [h("span", "Child 1")])]);
        const vnode2 = h("div", "Text node");
        patch(vnode0, vnode1);
        patch(vnode1, vnode2);
        expect(calls).toBe(1);
      });

      test("calls `init` and `prepatch` listeners on root", function () {
        let count = 0;
        function init(vnode) {
          expect(vnode).toBe(vnode2);
          count += 1;
        }
        function prepatch(oldVnode, vnode) {
          expect(vnode).toBe(vnode1);
          count += 1;
        }
        const vnode1 = h("div", { hook: { init: init, prepatch: prepatch } });
        patch(vnode0, vnode1);
        expect(count).toBe(1);
        const vnode2 = h("span", { hook: { init: init, prepatch: prepatch } });
        patch(vnode1, vnode2);
        expect(count).toBe(2);
      });

      test("removes element when all remove listeners are done", function () {
        let rm1, rm2, rm3;
        const patch = init([
          {
            remove: function (_, rm) {
              rm1 = rm;
            },
          },
          {
            remove: function (_, rm) {
              rm2 = rm;
            },
          },
        ]);
        const vnode1 = h("div", [
          h("a", {
            hook: {
              remove: function (_, rm) {
                rm3 = rm;
              },
            },
          }),
        ]);
        const vnode2 = h("div", []);
        elm = patch(vnode0, vnode1).elm;
        expect(elm.children).toHaveLength(1);
        elm = patch(vnode1, vnode2).elm;
        expect(elm.children).toHaveLength(1);
        rm1();
        expect(elm.children).toHaveLength(1);
        rm3();
        expect(elm.children).toHaveLength(1);
        rm2();
        expect(elm.children).toHaveLength(0);
      });

      test("invokes remove hook on replaced root", function () {
        const result: any[] = [];
        const parent = document.createElement("div");
        const vnode0 = document.createElement("div");
        parent.appendChild(vnode0);
        function cb(vnode, rm) {
          result.push(vnode);
          rm();
        }
        const vnode1 = h("div", { hook: { remove: cb } }, [h("b", "Child 1"), h("i", "Child 2")]);
        const vnode2 = h("span", [h("b", "Child 1"), h("i", "Child 2")]);
        patch(vnode0, vnode1);
        patch(vnode1, vnode2);
        expect(result).toHaveLength(1);
      });
    });

    describe("module hooks", function () {
      test("invokes `pre` and `post` hook", function () {
        const result: any[] = [];
        const patch = init([
          {
            pre: function () {
              result.push("pre");
            },
          },
          {
            post: function () {
              result.push("post");
            },
          },
        ]);
        const vnode1 = h("div");
        patch(vnode0, vnode1);
        expect(result).toEqual(["pre", "post"]);
      });

      test("invokes global `destroy` hook for all removed children", function () {
        const result: any[] = [];
        function cb(vnode) {
          result.push(vnode);
        }
        const vnode1 = h("div", [
          h("span", "First sibling"),
          h("div", [h("span", { hook: { destroy: cb } }, "Child 1"), h("span", "Child 2")]),
        ]);
        const vnode2 = h("div");
        patch(vnode0, vnode1);
        patch(vnode1, vnode2);
        expect(result).toHaveLength(1);
      });

      test("handles text vnodes with `undefined` `data` property", function () {
        const vnode1 = h("div", [" "]);
        const vnode2 = h("div", []);
        patch(vnode0, vnode1);
        patch(vnode1, vnode2);
      });

      test("invokes `destroy` module hook for all removed children", function () {
        let created = 0;
        let destroyed = 0;
        const patch = init([
          {
            create: function () {
              created++;
            },
          },
          {
            destroy: function () {
              destroyed++;
            },
          },
        ]);
        const vnode1 = h("div", [
          h("span", "First sibling"),
          h("div", [h("span", "Child 1"), h("span", "Child 2")]),
        ]);
        const vnode2 = h("div");
        patch(vnode0, vnode1);
        patch(vnode1, vnode2);
        expect(created).toBe(4);
        expect(destroyed).toBe(4);
      });

      test("does not invoke `create` and `remove` module hook for text nodes", function () {
        let created = 0;
        let removed = 0;
        const patch = init([
          {
            create: function () {
              created++;
            },
          },
          {
            remove: function () {
              removed++;
            },
          },
        ]);
        const vnode1 = h("div", [h("span", "First child"), "", h("span", "Third child")]);
        const vnode2 = h("div");
        patch(vnode0, vnode1);
        patch(vnode1, vnode2);
        expect(created).toBe(2);
        expect(removed).toBe(2);
      });

      test("does not invoke `destroy` module hook for text nodes", function () {
        let created = 0;
        let destroyed = 0;
        const patch = init([
          {
            create: function () {
              created++;
            },
          },
          {
            destroy: function () {
              destroyed++;
            },
          },
        ]);
        const vnode1 = h("div", [
          h("span", "First sibling"),
          h("div", [h("span", "Child 1"), h("span", ["Text 1", "Text 2"])]),
        ]);
        const vnode2 = h("div");
        patch(vnode0, vnode1);
        patch(vnode1, vnode2);
        expect(created).toBe(4);
        expect(destroyed).toBe(4);
      });
    });
  });

  describe("short circuiting", function () {
    test("does not update strictly equal vnodes", function () {
      const result: any[] = [];
      function cb(vnode) {
        result.push(vnode);
      }
      const vnode1 = h("div", [h("span", { hook: { update: cb } }, "Hello"), h("span", "there")]);
      patch(vnode0, vnode1);
      patch(vnode1, vnode1);
      expect(result).toHaveLength(0);
    });

    test("does not update strictly equal children", function () {
      const result: any[] = [];
      function cb(vnode) {
        result.push(vnode);
      }
      const vnode1 = h("div", [
        h("span", { hook: <any>{ patch: cb } }, "Hello"),
        h("span", "there"),
      ]);
      const vnode2 = h("div");
      vnode2.children = vnode1.children;
      patch(vnode0, vnode1);
      patch(vnode1, vnode2);
      expect(result).toHaveLength(0);
    });
  });
});

//------------------------------------------------------------------------------
// Html to vdom
//------------------------------------------------------------------------------
describe("html to vdom", function () {
  let elm, vnode0;
  beforeEach(function () {
    elm = document.createElement("div");
    vnode0 = elm;
  });

  test("empty strings return empty list", function () {
    expect(htmlToVDOM("")).toEqual([]);
  });

  test("just text", function () {
    const nodeList = htmlToVDOM("simple text");
    expect(nodeList).toHaveLength(1);
    expect(nodeList[0]).toEqual({ text: "simple text" });
  });

  test("empty tag", function () {
    const nodeList = htmlToVDOM("<span></span>");
    expect(nodeList).toHaveLength(1);
    elm = patch(vnode0, nodeList[0]).elm;
    expect(elm.outerHTML).toEqual("<span></span>");
  });

  test("tag with text", function () {
    const nodeList = htmlToVDOM("<span>abc</span>");
    expect(nodeList).toHaveLength(1);
    elm = patch(vnode0, nodeList[0]).elm;
    expect(elm.outerHTML).toEqual("<span>abc</span>");
  });

  test("tag with attribute", function () {
    const nodeList = htmlToVDOM(`<span a="1" b="2">abc</span>`);
    expect(nodeList).toHaveLength(1);
    elm = patch(vnode0, nodeList[0]).elm;
    expect(elm.outerHTML).toEqual(`<span a="1" b="2">abc</span>`);
  });

  test("misc", function () {
    const nodeList = htmlToVDOM(`<span a="1" b="2">abc<div>1</div></span>`);
    expect(nodeList).toHaveLength(1);
    elm = patch(vnode0, nodeList[0]).elm;
    expect(elm.outerHTML).toEqual(`<span a="1" b="2">abc<div>1</div></span>`);
  });

  test("svg", function () {
    const nodeList = htmlToVDOM(`<svg></svg>`);
    expect(nodeList).toHaveLength(1);
    elm = patch(vnode0, nodeList[0]).elm;
    expect(elm).toBeInstanceOf(SVGSVGElement);
  });
});
