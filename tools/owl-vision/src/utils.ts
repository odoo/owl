import * as vscode from 'vscode';

let statusMessage: vscode.StatusBarItem | undefined = undefined;

export function showStatusMessage(text: string) {
    if (!statusMessage) {
        statusMessage = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    }
    statusMessage.text = `$(sync~spin) ${text}`;
    statusMessage.show();
}

export function hideStatusMessage() {
    statusMessage?.hide();
}

export function getActiveCursorIndex(lineDelta = 0): number {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return 0;
    }
    const position = editor.selection.active.translate(lineDelta);
    return editor.document.offsetAt(position);
}

export function getSelectedText(regex?: RegExp, document?: vscode.TextDocument, position?: vscode.Position): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!document) {
        if (!editor) {
            return;
        }
        document = editor.document;
    }

    position = position || vscode.window.activeTextEditor?.selection.active;

    if (!position) {
        return;
    }

    const wordRange = document.getWordRangeAtPosition(position, regex);
    if (!wordRange) {
        return;
    }
    return document.getText(wordRange);
}

export function getClosestMatch(str: string, regex: RegExp, lineDelta = 0): string | undefined {
    const index = getActiveCursorIndex(lineDelta);
    const matches = [...str.matchAll(regex)];

    if (matches.length === 0) {
        return;
    }

    let closestMatch = matches[0];
    let closestDistance = Math.abs(index - (closestMatch.index || 0));

    for (const match of matches) {
        const matchIndex = match.index || 0;
        const distance = Math.abs(index - matchIndex);
        if (matchIndex < index && distance < closestDistance) {
            closestMatch = match;
            closestDistance = distance;
        }
    }

    return closestMatch[1];
}
