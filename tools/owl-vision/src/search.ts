import { GlobPattern, Location, Range, Uri, window, workspace } from 'vscode';
import { OpenDirection, getClosestMatch, getSelectedText, hideStatusMessage, showResult, showStatusMessage } from './utils';
import path = require('path');

export class Search {

    finderCache = new Map<string, Uri>();

    public async switch(openDirection: OpenDirection = OpenDirection.Active) {
        if (!this.currentDocument) {
            return;
        }

        let result = undefined;
        const text = this.currentDocument.getText();
        const isJs = this.currentDocument.fileName.endsWith(".js");
        const templateName = this.getTemplateName(text, isJs);

        if (templateName && isJs) {
            result = await this.findTemplate(templateName);
        } else if (templateName) {
            result = await this.findComponentFromTemplateName(templateName);
        }

        if (result !== undefined) {
            showResult(result, openDirection);
        } else if (isJs) {
            window.showWarningMessage(`Could not find a template for current component`);
        } else {
            window.showWarningMessage(`Could not find a component for current template`);
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
            showResult(result);
        } else {
            window.showWarningMessage(`Could not find a component for "${currentWord}"`);
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
            showResult(result);
        } else {
            window.showWarningMessage(`Could not find a template for "${currentWord}"`);
        }
        hideStatusMessage();
    }

    public async findComponent(componentName: string): Promise<Location | undefined> {
        if (componentName.toLowerCase() === componentName || componentName.includes(".") || componentName.includes("-")) {
            return;
        }

        const query = this.buildQuery(`class\\s+`, componentName, `\\s+extends`);
        return await this.find(componentName, query, "js");
    }

    public async findTemplate(templateName: string): Promise<Location | undefined> {
        const isComponentName = templateName.match(/^[A-Z][a-zA-Z0-9_]*$/);

        if (isComponentName) {
            const componentResult = await this.findComponent(templateName);
            if (!componentResult) {
                return;
            } else {
                const text = (await workspace.openTextDocument(componentResult.uri)).getText();
                const foundTemplateName = this.getTemplateName(text, true);
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

    private findComponentFromTemplateName(templateName: string): Promise<Location | undefined> {
        const query = this.buildQuery(`template\\s*=\\s*["']`, templateName, `["']`);
        return this.find(templateName, query, "js");
    }

    private getTemplateName(str: string, isJsFile: boolean): string | undefined {
        if (isJsFile) {
            return getClosestMatch(str, /template\s*=\s*["']([a-zA-Z0-9_\-\.]+)["']/g, +1);
        } else {
            return getClosestMatch(str, /t-name="([a-zA-Z0-9_\-\.]+)"/g);
        }
    }

    public async find(
        name: string,
        searchQuery: string,
        fileType: "js" | "xml",
    ): Promise<Location | undefined> {
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

        const include = `{${workspace.getConfiguration().get(`owl-vision.include`)}, *.${fileType}}`;
        const exclude = `{${workspace.getConfiguration().get(`owl-vision.exclude`)}}`;
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
        include: GlobPattern,
        exclude: GlobPattern,
    ): Promise<Array<Uri>> {
        const files = await workspace.findFiles(include, exclude);
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
        file: Uri,
        searchQuery: string,
    ): Promise<Location | undefined> {
        const document = await workspace.openTextDocument(file);
        const text = document.getText();
        const match = text.match(new RegExp(searchQuery));

        if (match) {
            const index = match.index || 0;
            return new Location(file, new Range(
                document.positionAt(index),
                document.positionAt(index)
            ));
        }
    }

    private get currentDocument() {
        return window.activeTextEditor?.document;
    }

    private buildQuery(
        prefix: string,
        content: string,
        postfix: string,
    ): string {
        return `(?<=${prefix})(${content})(?=${postfix})`;
    }
}

