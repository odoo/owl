import { writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from 'url';

const REPOSITORY = {};

export function exportPatterns(injectionSelector, scopeName, patterns) {
    const data = {
        injectionSelector: injectionSelector,
        scopeName: scopeName,
        patterns: [],
        repository: {}
    }

    for (const pattern of patterns) {
        data.patterns.push({ include: `#${pattern.id}` });
    }

    for (const id in REPOSITORY) {
        const pattern = { ...REPOSITORY[id] };

        delete pattern.id;

        data.repository[id] = pattern;
    }

    const currentDir = dirname(fileURLToPath(import.meta.url));
    const filePath = resolve(currentDir, "../syntaxes", `${scopeName}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 4));
    console.info(`Sucessfuly build ./syntaxes/${scopeName}.json`);
}

export function createPattern(id, { name, match, begin, end, contentName, beginCaptures, endCaptures, patterns }) {
    const pattern = { ...arguments[1] };
    if (id) {
        pattern.id = id;
        REPOSITORY[id] = pattern;
    }

    function mapCaptures(name, captures) {
        if (!captures) {
            return;
        }

        pattern[name] = {};
        for (const key in captures) {
            pattern[name][key] = { name: captures[key] }
        }
    }

    mapCaptures("beginCaptures", beginCaptures);
    mapCaptures("endCaptures", endCaptures);

    pattern.patterns = [];

    if (patterns) {
        for (const childPattern of patterns) {
            if (typeof childPattern === "string") {
                pattern.patterns.push({ include: childPattern });
            } else if (childPattern.id) {
                pattern.patterns.push({ include: `#${childPattern.id}` });
            } else {
                pattern.patterns.push(childPattern);
            }
        }
    }

    return pattern;
}

export function createTagPattern(id, { match, name, patterns }) {
    return createPattern(id, {
        begin: `(</?)(${match})`,
        beginCaptures: {
            "1": "punctuation.definition.tag.xml owl.xml.punctuation",
            "2": name,
        },
        end: "\\s*([/?]?>)",
        endCaptures: {
            "1": "punctuation.definition.tag.xml punctuation",
        },
        patterns,
    });
}

export function createAttributePatterns(id, { match, attributeName, contentName = "", patterns = [] }) {
    return createPattern(id, {
        patterns: [
            createPattern(undefined, {
                contentName: contentName !== null ? (contentName + " string.quoted.double.xml").trim() : undefined,
                begin: `(\\s*)(${match})(=)(")`,
                beginCaptures: {
                    "2": "entity.other.attribute-name.localname.xml " + attributeName,
                    "4": "punctuation.definition.string.begin.xml",
                },
                end: `(")`,
                endCaptures: {
                    "0": "punctuation.definition.string.end.xml",
                },
                patterns,
            }),
            createPattern(undefined, {
                contentName: contentName !== null ? (contentName + " string.quoted.single.xml").trim() : undefined,
                begin: `(\\s*)(${match})(=)(')`,
                beginCaptures: {
                    "2": "entity.other.attribute-name.localname.xml " + attributeName,
                    "4": "punctuation.definition.string.begin.xml",
                },
                end: `(')`,
                endCaptures: {
                    "0": "punctuation.definition.string.end.xml",
                },
                patterns,
            })
        ]
    });
}
