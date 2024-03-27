import { CancellationToken, CompletionContext, CompletionItem, CompletionItemKind, CompletionItemProvider, CompletionList, DefinitionProvider, Location, Position, Range, TextDocument, TextDocumentContentProvider, Uri, commands, workspace } from "vscode";
import { Search } from "../search";
import { getSelectedText, hash, readFile } from "../utils";
import { elements, events, owlComponentAttributes, owlElementAttributes } from "./items";
import { ParseResultType, ParseResult, parse, getNodePath, parseXml } from "./parser";

/**
 * Commands return basic js object which needs to be converted
 * to actual CompletionItem instances, this methods streamlines
 * this process.
 */
function mapCompletionItems(items: any): CompletionItem[] {
    return items.map((i: any) => {
        const item = new CompletionItem(i.label, i.kind);
        item.sortText = i.sortText;
        item.detail = i.detail;
        item.filterText = i.filterText;
        item.insertText = i.insertText?.startsWith?.(".") ? i.insertText.substring(1) : i.insertText;
        return item;
    });
}

function filterComponentItems(items: CompletionItem[], excludedLabels: string[] = []): CompletionItem[] {
    return items.filter((item) => {
        return !excludedLabels.includes(item.label.toString()) && [
            CompletionItemKind.Field,
            CompletionItemKind.Method,
            CompletionItemKind.Variable,
            CompletionItemKind.Property,
        ].includes(item.kind as number);
    });
}

/**
 * Adds "this." in front of the expression if needed and increments
 * the expression offset accordingly.
 */
function contextualize(properties: string[], expression: string, expressionOffset = 0) {
    const match = expression.match(/^([a-zA-Z_]+)\b/);
    if (!expression.startsWith("this.") && ((match && properties.includes(match[1])) || expression.match(/^\s*$/))) {
        expression = "this." + expression;
        expressionOffset += 5;
    }
    return { expression, expressionOffset };
};

const Commands = {
    Completion: "vscode.executeCompletionItemProvider",
    Definition: "vscode.executeDefinitionProvider",
}

export class OwlLanguageFeaturesProvider implements CompletionItemProvider, TextDocumentContentProvider, DefinitionProvider {

    virtualDocuments = new Map();
    componentProperties = new Map();
    search: Search;

    constructor(search: Search) {
        this.search = search;
        workspace.registerTextDocumentContentProvider("owl", this);
    }

    /**
     * TextDocumentContentProvider interface implementation to provide
     * virtual documents to vscode commands.
     */
    async provideTextDocumentContent(uri: Uri) {
        const id = uri.toString(true);
        return this.virtualDocuments.get(id);
    }

    /**
     * DefinitionProvider interface implementation.
     *
     * - If the target is a js expression, will try to find the definition
     * inside the current component.
     * - If the target is a component element, will try to find the definition
     * of the component.
     */
    async provideDefinition(document: TextDocument, position: Position) {
        let offset = document.offsetAt(position);
        const documentText = document.getText();
        const parseResult = await parse(documentText, offset);

        if (parseResult.type === ParseResultType.Expression) {
            const component = await this.search.getCurrentComponent();
            if (!component) {
                return;
            }

            const { xmlDocument, xmlNode } = parseXml(documentText, offset);
            const componentText = await readFile(component.uri);
            const virtualDocument = await this.getVirtualJsDocument(document.uri, component.componentName, componentText, xmlDocument, xmlNode, parseResult);

            const definitions: any = await this.executeCommand(
                Commands.Definition,
                document.uri,
                virtualDocument.content,
                virtualDocument.offset
            );

            if (definitions.length > 0) {
                const selectionRange = definitions[0].targetSelectionRange;
                const range = new Range(
                    new Position(selectionRange.start.line, selectionRange.start.character),
                    new Position(selectionRange.end.line, selectionRange.end.character),
                )
                return new Location(component.uri, range);
            }
        } else if (parseResult.type === ParseResultType.Attribute) {
            const { xmlNode } = parseXml(documentText, offset);

            const childComponent = await this.search.findComponent(xmlNode.name);
            if (!childComponent) {
                return [];
            }

            const modifiersRegex = new RegExp([
                "\\.bind",
                "\\.stop",
                "\\.prevent",
                "\\.self",
                "\\.capture",
                "\\.sythetic",
            ].join("|"), "g");

            let attributeName = getSelectedText(/\b[a-zA-Z0-9_\-.]+\b/, document, position)
            attributeName = attributeName?.replace(modifiersRegex, "") ?? "";

            const componentText = await readFile(childComponent.uri);
            const content = `${componentText}\n${xmlNode.name}.props.${attributeName}`;
            const definitions: any = await this.executeCommand(Commands.Definition, document.uri, content);

            if (definitions.length > 0) {
                const selectionRange = definitions[0].targetSelectionRange;
                const range = new Range(
                    new Position(selectionRange.start.line, selectionRange.start.character),
                    new Position(selectionRange.end.line, selectionRange.end.character),
                )
                return new Location(childComponent.uri, range);
            }
        } else if (parseResult.type === ParseResultType.Element) {
            const currentWord = getSelectedText(/<\/?[A-Z][a-zA-Z]+/, document, position);
            if (!currentWord) {
                return;
            }
            const componentName = currentWord.replace(/[\/<]/g, "").trim();
            return await this.search.findComponent(componentName);
        }
    }

    /**
     * CompletionItemProvider interface implementation
     *
     * See {@link provideElementItems}, {@link provideAttributeItems} and {@link provideExpressionItems}
     * for further details.
     */
    async provideCompletionItems(
        document: TextDocument,
        position: Position,
        token: CancellationToken,
        context: CompletionContext
    ): Promise<CompletionItem[]> {
        const component = await this.search.getCurrentComponent();
        if (!component || token.isCancellationRequested) {
            return [];
        }

        const offset = document.offsetAt(position);
        const documentText = document.getText();

        const parseResult = await parse(documentText, offset);
        const { xmlDocument, xmlNode } = parseXml(documentText, offset);

        if (parseResult.type === ParseResultType.Expression) {
            return this.provideExpressionItems(document.uri, component.uri, component.componentName, xmlDocument, xmlNode, parseResult);
        } else if (parseResult.type === ParseResultType.Attribute) {
            return this.provideAttributeItems(document.uri, xmlNode);
        } else if (parseResult.type === ParseResultType.Element) {
            return this.provideElementItems(document.uri, component.uri, component.componentName, parseResult);
        }

        return [];
    }

    /**
     * Returns the completion items for attributes.
     * - Returns props if the element is a component
     * - Returns the owl directives based on the element type
     */
    private async provideAttributeItems(
        documentUri: Uri,
        xmlNode: any,
    ): Promise<CompletionItem[]> {
        if (!xmlNode || xmlNode.name === xmlNode.name.toLowerCase()) {
            return [...owlElementAttributes, ...events];
        }

        const childComponent = await this.search.findComponent(xmlNode.name);
        if (!childComponent) {
            return [];
        }

        const componentText = await readFile(childComponent.uri);
        const content = `${componentText}\n${xmlNode.name}.props.`;
        const list = await this.executeCommand(Commands.Completion, documentUri, content) as CompletionList;

        const modifiersRegex = new RegExp([
            "\\.bind",
            "\\.stop",
            "\\.prevent",
            "\\.self",
            "\\.capture",
            "\\.sythetic",
        ].join("|"), "g");

        const excludedAttrs = [
            "slots",
            ...Object.keys(xmlNode.attr).map(attr => attr.replace(modifiersRegex, ""))
        ];

        return mapCompletionItems(filterComponentItems([
            ...owlComponentAttributes,
            ...list.items
        ], excludedAttrs));
    }

    /**
     * Returns the completion items for elements, this includes
     * components, "t" and html elements.
     */
    private async provideElementItems(
        documentUri: Uri,
        componentUri: Uri,
        componentName: string,
        parseResult: any,
    ): Promise<CompletionItem[]> {
        const componentText = await readFile(componentUri);

        const content = `${componentText}\n${componentName}.components.${parseResult.expression}`;
        const list = await this.executeCommand(Commands.Completion, documentUri, content) as CompletionList;

        return mapCompletionItems([
            ...elements,
            ...filterComponentItems(list.items),
        ]);
    }

    /**
     * Returns the completion items for a js expression
     */
    private async provideExpressionItems(
        documentUri: Uri,
        componentUri: Uri,
        componentName: string,
        xmlDocument: any,
        xmlNode: any,
        parseResult: ParseResult,
    ): Promise<CompletionItem[]> {
        let { attributeName } = parseResult;

        const dynamicAttributeRegex = new RegExp([
            "t-if",
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
            "t-att",
            "t-tag",
            "t-log",
            "t-model",
            "t-att-[a-z_:.-]+",
            "t-on-[a-z_:.-]+"
        ].join("|"));

        if (xmlNode.name === xmlNode.name.toLowerCase() && !dynamicAttributeRegex.test(attributeName)) {
            return [];
        }

        const componentText = await readFile(componentUri);
        const virtualDocument = await this.getVirtualJsDocument(documentUri, componentName, componentText, xmlDocument, xmlNode, parseResult);

        const completionList = await this.executeCommand(
            Commands.Completion,
            documentUri,
            virtualDocument.content,
            virtualDocument.offset
        ) as CompletionList;

        let items = filterComponentItems(completionList.items, ["__VIRTUAL__", "setup"]);

        if (!/\bthis\./.test(parseResult.expression)) {
            items = items.map(item => {
                let insertText = item.insertText as string;
                if (/\bthis\./.test(insertText)) {
                    item.insertText = insertText.replace(/\bthis\./, "");
                }
                return item;
            })
        }

        return mapCompletionItems([...items]);
    }

    /**
     * Creates a virtual document to provide the appropriate
     * completion items for a parsed js expression.
     *
     * This method:
     * - Adds default owl variables such as env and props
     * - Adds mocks for frequently used Owl imports (which cannot be resolved using commands)
     * - Adds local variables generated from Owl xml directives such as t-for or t-set
     * - Will try to add a "this." in front of the js expression if it was omitted so it can
     *   be understood by vscode typescript server.
     *
     * The expression offset is also modified accordingly.
     */
    async getVirtualJsDocument(
        documentUri: Uri,
        componentName: string,
        componentText: string,
        xmlDocument: any,
        xmlNode: any,
        parseResult: ParseResult,
    ) {
        const properties = await this.getComponentProperties(documentUri, componentName, componentText);

        // As imports do not work, use mocks for frequently used owl functions.
        let importReplacements = workspace.getConfiguration().get(`owl-vision.autocomplete-mocks`);

        // As imports do not work, manually add "env" and "props"
        // to the current component instance.
        const localVariables = [
            "let env = {};",
            "this.env = env;",
            `let props = ${componentName}.props;`,
            `this.props = props;`,
        ];

        // Adds local variables generated based on the template
        const path = getNodePath(xmlDocument, xmlNode);
        for (const node of path) {
            if (node.attr["t-foreach"]) {
                let array = contextualize(properties, node.attr["t-foreach"]).expression;
                localVariables.push(`const ${node.attr["t-as"]} = ${array}[0];`);
                localVariables.push(`const ${node.attr["t-as"]}_index = 0;`);
                localVariables.push(`const ${node.attr["t-as"]}_first = ${array}[0];`);
                localVariables.push(`const ${node.attr["t-as"]}_last = ${array}.at(-1);`);
                localVariables.push(`const ${node.attr["t-as"]}_value = {};`);
            } else if (node.attr["t-set"]) {
                localVariables.push(`const ${node.attr["t-set"]} = ${node.attr["t-value"]};`);
            }
        }

        const { expression, expressionOffset } = contextualize(properties, parseResult.expression, parseResult.expressionOffset);

        return {
            offset: expressionOffset,
            content: `${componentText}
${importReplacements}
class __VIRTUAL__ extends ${componentName} { __VIRTUAL__() {
${localVariables.join("\n")}
${expression} }}`,
        }
    }

    /**
     * Returns the list of properties for a given component class.
     * The result in cached in `componentProperties`.
     *
     * @param documentUri
     * @param componentName
     * @param componentText
     * @returns
     */
    async getComponentProperties(
        documentUri: Uri,
        componentName: string,
        componentText: string,
    ): Promise<string[]> {
        const check = hash(componentText);

        let cached = this.componentProperties.get(componentName);
        if (!cached || cached.check !== check) {
            const contextExpression = `${componentText}\nclass __VIRTUAL__ extends ${componentName} { __VIRTUAL__() { \nthis. }}`;
            const contextItemsCompletion = await this.executeCommand(Commands.Completion, documentUri, contextExpression, 5) as CompletionList;

            const items = filterComponentItems(contextItemsCompletion.items, ["__VIRTUAL__", "setup"]).map(item => item.label);

            cached = { check, items };
            this.componentProperties.set(componentName, cached);
        }

        return cached.items;
    }

    private async executeCommand(commandId: string, uri: Uri, content: string, offset: any = undefined) {
        const lines = content.split(/\r\n|\r|\n/);
        const _offset = offset !== undefined ? offset : (lines.at(-1)?.length ?? 0);
        const position = new Position(lines.length - 1, _offset);

        const originalUri = uri.toString(true);
        const hashValue = hash(content);

        const id = `owl://js/${originalUri}_${hashValue}.js`;
        this.virtualDocuments.set(id, content);

        return await commands.executeCommand(
            commandId,
            Uri.parse(`owl://js/${encodeURIComponent(originalUri)}_${hashValue}.js`),
            position
        );
    }
}
