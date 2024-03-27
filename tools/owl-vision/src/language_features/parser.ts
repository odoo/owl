import { XmlDocument, XmlElement, XmlNode } from "xmldoc";

export enum ParseResultType {
    Expression,
    Attribute,
    Element
}

export interface ParseResult {
    type: ParseResultType;
    expression: string;
    expressionOffset: number;
    attributeName: string
}

/**
 * Will parse the document to find the selected expression based on an offset.
 * The result can be on of three types:
 *
 * Element: The offset is on a element tag name, the expression is the current
 * tagname or and empty string if it's just a opening tag.
 *
 * Attribute: The offset is inside the element but not in an attribute value,
 * the expression is the current attribute name if any.
 *
 * Expression: The offset is inside an attribute value, the expression is the value.
 */
export async function parse(
    documentText: string,
    offset: number,
): Promise<ParseResult> {

    // Check if the offset is preceded by "<xyz", if true returns a type Element
    // with the current name.
    const elementMatch = documentText.substring(0, offset).match(/<([a-zA-Z\-._]*)$/);
    if (elementMatch) {
        return {
            type: ParseResultType.Element,
            expression: elementMatch[1] || "",
            expressionOffset: elementMatch[1].length || 0,
            attributeName: "",
        };
    }

    let {
        value: expression,
        offset: expressionOffset,
        from,
    } = getSection(documentText, offset, '="', '"');

    // If the expression contains '"', it means we aren't inside an attribute
    // value.
    if (expression.includes('"')) {
        const attributeMatch = documentText.substring(0, offset).match(/\s([a-zA-Z\-._]*)$/);
        if (attributeMatch) {
            return {
                type: ParseResultType.Attribute,
                expression: attributeMatch[1] || "",
                expressionOffset: attributeMatch[1].length || 0,
                attributeName: "",
            };
        }
    }

    let attributeName = "";
    let i = from - 2;
    while (/\S/.test(documentText[i])) {
        attributeName = documentText[i] + attributeName;
        i--;
    }

    return {
        type: ParseResultType.Expression,
        expression,
        expressionOffset,
        attributeName,
    };
}

export function getSection(text: string, offset: number, prefix: string, postfix: string) {
    const beforeText = text.substring(0, offset);
    let from = beforeText.lastIndexOf(prefix);
    const afterText = text.substring(offset);
    const to = beforeText.length + afterText.indexOf(postfix);

    from = from + (prefix.length);

    return {
        value: text.substring(from, to),
        offset: offset - from,
        from: from,
        to,
    };
}

/**
 * Returns 2 xml nodes:
 * xmlNode: Tries to create the current element based on a string offset,
 * even if the node is invalid.
 * xmlDocument: The document root element, only works if the document is
 * valid xml.
 */
export function parseXml(text: string, offset: number): any {
    let xmlDocument = undefined;
    try {
        xmlDocument = new XmlDocument(text);
    } catch (error) { }

    let i = 0;
    while (text[offset + i] !== "<") {
        i--;
    }

    let node = "";
    while (text[offset + i] !== ">" || text[offset + i - 1] === "=") {
        node += text[offset + i];
        i++;
    }

    let xmlNode = undefined;
    try {
        xmlNode = new XmlDocument(`${node}${node.endsWith("/") ? '' : '/'}>`);
    } catch (error) { }

    return { xmlDocument, xmlNode };
}

/**
 * Returns an array representing the elements order from the document's
 * root to the specified element.
 */
export function getNodePath(xmlDocument: XmlDocument, xmlNode: any): Array<XmlElement> {
    let path: Array<XmlElement> = [];

    const traverse = (node: XmlElement, currentPath: Array<XmlElement>) => {
        if (node.name === xmlNode.name && JSON.stringify(node.attr) === JSON.stringify(xmlNode.attr)) {
            path = currentPath;
            return;
        }

        if (node.children) {
            for (const child of node.children) {
                if (child instanceof XmlElement && child.name) {
                    traverse(child, currentPath.concat(child));
                }
            }
        }
    }

    traverse(xmlDocument, []);

    return path;
}
