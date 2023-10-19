import path = require('path');
import * as vscode from 'vscode';
import { getSelectedText, showStatusMessage, hideStatusMessage, getActiveCursorIndex, getClosestMatch } from './utils';

class SearchResult {
    uri: vscode.Uri;
    range: vscode.Range;

    constructor(uri: vscode.Uri, range: vscode.Range) {
        this.uri = uri;
        this.range = range;
    }
}

export class Search {

    finderCache = new Map<string, vscode.Uri>();

    public async switchCommand(openBesides: Boolean = false) {
        if (!this.currentDocument) {
            return;
        }

        let result = undefined;
        const text = this.currentDocument.getText();
        const isJs = this.currentDocument.fileName.endsWith(".js");
        const isXml = this.currentDocument.fileName.endsWith(".xml");

        if (isJs) {
            const templateName = this.getTemplateNameInJS(text);
            if (templateName) {
                result = await this.findTemplate(templateName);
            }
        } else if (isXml) {
            const templateName = this.getTemplateNameInXML(text);
            if (templateName) {
                result = await this.findComponentFromTemplateName(templateName);
            }
        }

        if (result !== undefined) {
            this.showResult(result, openBesides);
        } else if (isJs) {
            vscode.window.showWarningMessage(`Could not find a template for current component`);
        } else if (isXml) {
            vscode.window.showWarningMessage(`Could not find a component for current template`);
        }
    }

    public async findComponentCommand() {
        const currentWord = getSelectedText();
        if (!currentWord) {
            return;
        }

        showStatusMessage(`Searching for component "${currentWord}"`);
        const result = await this.findComponent(currentWord);
        if (result) {
            this.showResult(result);
        } else {
            vscode.window.showWarningMessage(`Could not find a component for "${currentWord}"`);
        }
        hideStatusMessage();
    }

    public async findTemplateCommand() {
        const currentWord = getSelectedText(/[\w.-]+/);
        if (!currentWord) {
            return;
        }

        showStatusMessage(`Searching for template "${currentWord}"`);
        const result = await this.findTemplate(currentWord);
        if (result) {
            this.showResult(result);
        } else {
            vscode.window.showWarningMessage(`Could not find a template for "${currentWord}"`);
        }
        hideStatusMessage();
    }

    public async findComponent(componentName: string): Promise<SearchResult | undefined> {
        if (componentName.toLowerCase() === componentName || componentName.includes(".") || componentName.includes("-")) {
            return;
        }

        const query = this.buildQuery(`class\\s+`, componentName, `\\s+extends`);
        return await this.find(componentName, query, "js");
    }

    public async findTemplate(templateName: string): Promise<SearchResult | undefined> {
        const isComponentName = templateName.match(/^[A-Z][a-zA-Z0-9_]*$/);

        if (isComponentName) {
            const componentResult = await this.findComponent(templateName);
            if (!componentResult) {
                return;
            } else {
                const document = await vscode.workspace.openTextDocument(componentResult.uri);
                const text = document.getText();
                const foundTemplateName = this.getTemplateNameInJS(text);
                if (foundTemplateName) {
                    templateName = foundTemplateName;
                } else {
                    return;
                }
            }
        }

        const query = this.buildQuery(`t-name="`, templateName, `"`);
        return await this.find(templateName, query, "xml");
    }

    private async findComponentFromTemplateName(templateName: string): Promise<SearchResult | undefined> {
        const query = this.buildQuery(`template\\s*=\\s*["']`, templateName, `["']`);
        return await this.find(templateName, query, "js");
    }

    private getTemplateNameInJS(str: string): string | undefined {
        return getClosestMatch(str, /template\s*=\s*["']([a-zA-Z0-9_\-\.]+)["']/g, +1);
    }

    private getTemplateNameInXML(str: string): string | undefined {
        return getClosestMatch(str, /t-name="([a-zA-Z0-9_\-\.]+)"/g);
    }

    private async find(
        name: string,
        searchQuery: string,
        fileType: "js" | "xml",
    ) {
        const key = `${name}-${fileType}`;
        const cachedUri = this.finderCache.get(key);
        if (cachedUri) {
            const result = await this.findInFile(cachedUri, searchQuery);
            if (result) {
                return result;
            } else {
                this.finderCache.delete(key);
            }
        }

        const include = `{${vscode.workspace.getConfiguration().get(`owl-vision.include`)}}`;
        const exclude = `{${vscode.workspace.getConfiguration().get(`owl-vision.exclude`)}}`;
        const files = await this.getFiles(name, include, exclude);

        for (const file of files) {
            const result = await this.findInFile(file, searchQuery);
            if (result) {
                this.finderCache.set(key, result.uri);
                return result;
            }
        }
    }

    private async getFiles(
        searchQuery: string,
        include: vscode.GlobPattern,
        exclude: vscode.GlobPattern,
    ): Promise<Array<vscode.Uri>> {
        const files = await vscode.workspace.findFiles(include, exclude);
        const parts = searchQuery.split(".").flatMap(s => s.split(/(?=[A-Z])/)).map(s => s.toLowerCase());
        const currentDir = this.currentDocument ? path.dirname(this.currentDocument.uri.path) : "";

        const results = files.map(file => {
            const filepath = file.path.toLowerCase();
            let score = 0;
            if (path.dirname(filepath) === currentDir) {
                score += 99;
            }
            for (const part of parts) {
                if (filepath.includes(part)) {
                    score++;
                }
            }
            return { score, file };
        })
            .sort((a, b) => a.score > b.score ? -1 : 1)
            .slice(0, 25);

        return results.map(r => r.file);
    }

    private async findInFile(
        file: vscode.Uri,
        searchQuery: string,
    ): Promise<SearchResult | undefined> {
        const document = await vscode.workspace.openTextDocument(file);
        const text = document.getText();
        const match = text.match(new RegExp(searchQuery));

        if (match) {
            const index = match.index || 0;
            return new SearchResult(file, new vscode.Range(
                document.positionAt(index),
                document.positionAt(index)
            ));
        }
    }

    private async showResult(result: SearchResult, openBesides: Boolean = false) {
        const editor = await vscode.window.showTextDocument(result.uri, {
            viewColumn: openBesides ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
        });

        editor.revealRange(result.range);
        editor.selection = new vscode.Selection(result.range.start, result.range.end);
    }

    private get currentDocument() {
        return vscode.window.activeTextEditor?.document;
    }

    private buildQuery(
        prefix: string,
        content: string,
        postfix: string,
    ): string {
        return `(?<=${prefix})(${content})(?=${postfix})`;
    }
}

