import * as vscode from 'vscode';
import { getSelectedText, showStatusMessage, hideStatusMessage } from './utils';
import { Search } from './search';

export class ComponentDefinitionProvider implements vscode.DefinitionProvider {

    search: Search;

    constructor(search: Search) {
        this.search = search;
    }

    /**
     * Interface implementation to provide definition when ctrl+click on Component
     * tag in template.
     */
    async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
        const currentWord = getSelectedText(/<\/?[A-Z][a-zA-Z]+/, document, position);
        if (!currentWord) {
            return;
        }
        const componentName = currentWord.replace(/[\/<]/g, "").trim();

        showStatusMessage(`Searching for component "${componentName}"`);
        const result = await this.search.findComponent(componentName);
        hideStatusMessage();
        return result;
    }
}
