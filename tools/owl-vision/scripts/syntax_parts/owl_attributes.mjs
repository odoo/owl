import { createAttributePatterns, createPattern } from "../syntax_builder_utils.mjs";

export const inilineJs = [createPattern("inline-js", {
    patterns: [
        {
            match: "\\s(=>)\\s",
            captures: {
                "1": {
                    name: "string.quoted.double.xml owl.arrow",
                }
            }
        },
        {
            match: "\\b(props)\\b",
            captures: {
                "1": {
                    name: "variable.language.js owl.expression.props",
                }
            }
        },
        {
            match: "\\s(and|or)\\s",
            captures: {
                "1": {
                    name: "keyword.operator.logical.js owl.logical",
                }
            }
        },
        {
            include: "source.js"
        }
    ]
})];

const formattedString = createPattern("formatted-string", {
    contentName: "meta.embedded.block.javascript",
    begin: `({{)`,
    beginCaptures: {
        "1": "owl.double-curlybrackets",
    },
    end: `(}})`,
    endCaptures: {
        "1": "owl.double-curlybrackets",
    },
    patterns: inilineJs
});

// -------------------------------- Attributes --------------------------------

export const htmlAttributes = createAttributePatterns("html-attributes", {
    match: "[a-z]{2}[a-z_:.-]+",
    attributeName: "owl.xml.attribute",
});

export const propsAttributes = createAttributePatterns("props-attributes", {
    match: "[a-zA-Z]{2}[a-zA-Z_:.]*",
    contentName: "meta.embedded.block.javascript",
    attributeName: "owl.attribute owl.attribute.props",
    patterns: inilineJs,
});

export const owlAttributesDynamic = createAttributePatterns("owl-attributes-dynamic", {
    match: [
        "t-if",
        "t-else",
        "t-elif",
        "t-foreach",
        "t-as",
        "t-key",
        "t-esc",
        "t-out",
        "t-props",
        "t-component",
        "t-set",
        "t-value",
        "t-portal",
        "t-slot-scope",
        "t-att-[a-z_:.-]+",
        "t-on-[a-z_:.-]+"
    ].join("|"),
    contentName: "meta.embedded.block.javascript",
    attributeName: "owl.attribute owl.attribute.dynamic",
    patterns: inilineJs,
});

export const owlAttributesStatic = createAttributePatterns("owl-attributes-static", {
    match: [
        "t-name",
        "t-ref",
        "t-set-slot",
        "t-model",
        "t-inherit",
        "t-inherit-mode",
        "t-translation"
    ].join("|"),
    attributeName: "owl.attribute owl.attribute.static",
});

export const owlAttributesFormattedString = createAttributePatterns("owl-attributes-formatted-string", {
    match: ["t-call", "t-slot", "t-attf-[a-z_:.-]+"].join("|"),
    attributeName: "owl.attribute owl.attribute.formatted",
    patterns: [formattedString],
});
