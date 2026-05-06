import {
  jsParser,
  htmlParser,
  xmlParser as baseXmlParser,
  parseMixed,
  LRLanguage,
  LanguageSupport,
} from "@libs/codemirror";

const DYNAMIC_ATTRS = new Set([
  "t-if", "t-elif", "t-foreach", "t-as", "t-key", "t-esc", "t-out",
  "t-props", "t-component", "t-set", "t-value", "t-portal",
  "t-slot-scope", "t-att", "t-tag", "t-log", "t-model",
]);

const FORMATTED_ATTRS = new Set(["t-call", "t-slot"]);

function getAttributeAndTagName(node, input) {
  const attrNode = node.node.parent;
  if (!attrNode || attrNode.name !== "Attribute") return null;

  const openTag = attrNode.parent;
  if (!openTag) return null;

  // Find AttributeName within Attribute
  let attrNameNode = attrNode.firstChild;
  while (attrNameNode && attrNameNode.name !== "AttributeName") {
    attrNameNode = attrNameNode.nextSibling;
  }
  if (!attrNameNode) return null;

  // Find TagName within OpenTag
  let tagNameNode = openTag.firstChild;
  while (tagNameNode && tagNameNode.name !== "TagName") {
    tagNameNode = tagNameNode.nextSibling;
  }

  return {
    attrName: input.read(attrNameNode.from, attrNameNode.to),
    tagName: tagNameNode ? input.read(tagNameNode.from, tagNameNode.to) : null,
  };
}

function getTaggedTemplateParser(node, input) {
  if (node.name !== "TemplateString") return null;

  const parent = node.node.parent;
  if (!parent || parent.name !== "TaggedTemplateExpression") return null;

  const tagNode = parent.firstChild;
  if (!tagNode) return null;

  const tagName = input.read(tagNode.from, tagNode.to);

  if (tagName === "xml") return owlXmlMixedParser;
  if (tagName === "markup") return htmlParser;

  return null;
}

const owlXmlMixedParser = baseXmlParser.configure({
  wrap: parseMixed((node, input) => {
    if (node.name !== "AttributeValue") return null;

    const info = getAttributeAndTagName(node, input);
    if (!info) return null;

    const { attrName, tagName } = info;

    // Strip surrounding quotes from the value range
    const from = node.from + 1;
    const to = node.to - 1;
    if (from >= to) return null;

    // t-if, t-foreach, t-on-*, t-att-*, etc. → full JS expression
    const isDynamicPrefixedAttr = /^(t-att|t-on)-/.test(attrName);
    const isComponentTag = tagName && /^[A-Z]/.test(tagName);
    if (DYNAMIC_ATTRS.has(attrName) || isDynamicPrefixedAttr || isComponentTag) {
      return { parser: jsParser, overlay: [{ from, to }] };
    }

    // t-call, t-slot, t-attf-* → JS only inside {{ ... }}
    if (FORMATTED_ATTRS.has(attrName) || /^t-attf-/.test(attrName)) {
      const content = input.read(from, to);
      const overlay = [];
      const re = /\{\{(.*?)\}\}/gs;
      let match;
      while ((match = re.exec(content)) !== null) {
        const jsFrom = from + match.index + 2;
        const jsTo = jsFrom + match[1].length;
        if (jsFrom < jsTo) overlay.push({ from: jsFrom, to: jsTo });
      }
      return overlay.length ? { parser: jsParser, overlay } : null;
    }

    return null;
  }),
});

export function createOwlXmlLanguage() {
  const owlXmlLang = LRLanguage.define({ parser: owlXmlMixedParser });
  return new LanguageSupport(owlXmlLang);
}

export function createOwlJsLanguage() {
  const mixedJsParser = jsParser.configure({
    wrap: parseMixed((node, input) => {
      const parser = getTaggedTemplateParser(node, input);
      return parser ? { parser } : null;
    })
  })

  const mixedJS = LRLanguage.define({ parser: mixedJsParser });
  return new LanguageSupport(mixedJS);
}
