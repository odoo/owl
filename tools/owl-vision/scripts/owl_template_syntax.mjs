import { createTagPattern, exportPatterns } from "./syntax_builder_utils.mjs";
import {
    htmlAttributes,
    owlAttributesDynamic,
    owlAttributesFormattedString,
    owlAttributesStatic,
    propsAttributes
} from "./syntax_parts/owl_attributes.mjs";
import { xpathAttributes } from "./syntax_parts/xpath.mjs";

const componentsTags = createTagPattern("component-tags", {
    match: "[A-Z][a-zA-Z0-9_]*",
    name: "entity.name.type.class owl.component",
    patterns: [
        owlAttributesDynamic,
        owlAttributesDynamic,
        propsAttributes,
    ],
});

const htmlTags = createTagPattern("html-tags", {
    match: "[a-z][a-zA-Z0-9_:.]+|[abiqsuw]",
    name: "entity.name.tag.localname.xml owl.xml.tag",
    patterns: [
        owlAttributesFormattedString,
        xpathAttributes,
        owlAttributesDynamic,
        owlAttributesStatic,
        htmlAttributes,
    ],
});

const tTag = createTagPattern("t-tag", {
    match: "t(?![a-zA-Z])",
    name: "entity.name.tag.localname.xml owl.tag",
    patterns: [
        propsAttributes,
        owlAttributesFormattedString,
        owlAttributesDynamic,
        owlAttributesStatic,
    ],
});

exportPatterns(
    "L:text.xml -comment",
    "owl.template",
    [componentsTags, htmlTags, tTag]
);
