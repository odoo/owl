import * as vscode from 'vscode';
import { Search } from './search';
import { ComponentDefinitionProvider } from './definiton_providers';
import { OpenDirection } from './utils';

export async function activate(context: vscode.ExtensionContext) {
    const search = new Search();

    context.subscriptions.push(vscode.commands.registerCommand('owl-vision.switch', () => search.switch()));
    context.subscriptions.push(vscode.commands.registerCommand('owl-vision.switch-besides', () => search.switch(OpenDirection.Besides)));
    context.subscriptions.push(vscode.commands.registerCommand('owl-vision.switch-below', () => search.switch(OpenDirection.Below)));
    context.subscriptions.push(vscode.commands.registerCommand('owl-vision.find-component', () => search.findComponentCommand()));
    context.subscriptions.push(vscode.commands.registerCommand('owl-vision.find-template', () => search.findTemplateCommand()));

    const componentDefProvider = new ComponentDefinitionProvider(search);
    context.subscriptions.push(vscode.languages.registerDefinitionProvider({ language: 'xml' }, componentDefProvider));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider({ language: 'javascript' }, componentDefProvider));
}

export function deactivate() { }
