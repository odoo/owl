import { createAttributePatterns, createPattern } from "../syntax_builder_utils.mjs";

const xpathPattern = [createPattern("xpath", {
    patterns: [
        {
            begin: "\\[",
            beginCaptures: {
                "0": {
                    name: "punctuation.definition",
                }
            },
            end: "\\]",
            endCaptures: {
                "0": {
                    name: "punctuation.definition",
                }
            },
            patterns: [
                {
                    begin: "'",
                    beginCaptures: {
                        "0": {
                            name: "punctuation.definition",
                        }
                    },
                    end: "'",
                    endCaptures: {
                        "0": {
                            name: "punctuation.definition",
                        }
                    },
                    contentName: "string.quoted.single",
                },
                {
                    begin: "\\\"",
                    beginCaptures: {
                        "0": {
                            name: "punctuation.definition",
                        }
                    },
                    end: "\\\"",
                    endCaptures: {
                        "0": {
                            name: "punctuation.definition",
                        }
                    },
                    contentName: "string.quoted.double",
                },
                {
                    match: "(@)([a-zA-Z0-9_:\\-]+)\\b",
                    captures: {
                        "1": {
                            name: "punctuation.definition",
                        },
                        "2": {
                            name: "entity.other.attribute-name",
                        }
                    }
                },
                {
                    match: "(\\(|\\))",
                    name: "meta.brace.round",
                },
                {
                    match: "[0-9]+(\\.[0-9]+)?",
                    name: "constant.numeric.decimal",
                },
                {
                    match: "\\b(hasclass)\\b",
                    captures: {
                        "1": {
                            name: "entity.name.function",
                        },
                    }
                },
            ]
        },
        {
            match: "/{1,2}",
            name: "text",
        },
        {
            match: "(?<!@)([A-Z][a-zA-Z]+)\\b",
            captures: {
                "1": {
                    name: "entity.name.type.class",
                }
            }
        },
        {
            match: "(?<!@)([a-z][a-zA-Z0-9_:.]+|[abiqsuw])\\b",
            captures: {
                "1": {
                    name: "entity.name.tag",
                }
            }
        },
    ]
})];

export const xpathAttributes = createAttributePatterns("xpath-attributes", {
    match: "expr",
    attributeName: "owl.xml.attribute owl.xml.attribute.xpath",
    patterns: xpathPattern,
});
