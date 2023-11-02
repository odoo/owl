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

export enum OpenDirection {
    Active,
    Besides,
    Below,
}

export async function showResult(result: vscode.Location, openDirection: OpenDirection = OpenDirection.Active) {
    let editor = undefined;

    if (openDirection == OpenDirection.Active) {
        editor = await vscode.window.showTextDocument(result.uri);
    } else {
        let targetColumn = vscode.ViewColumn.Beside;
        const existingDocument = vscode.workspace.textDocuments.find(t => t.uri.path === result.uri.path);
        if (existingDocument) {
            const currentColumn = vscode.window.activeTextEditor?.viewColumn;
            if (currentColumn == vscode.ViewColumn.One) {
                targetColumn = vscode.ViewColumn.Two;
            } else if (currentColumn == vscode.ViewColumn.Two) {
                targetColumn = vscode.ViewColumn.One;
            }
            editor = await vscode.window.showTextDocument(existingDocument, { viewColumn: targetColumn });
        } else {
            editor = await vscode.window.showTextDocument(result.uri, { viewColumn: targetColumn });
        }
    }

    if (openDirection === OpenDirection.Below) {
        await vscode.commands.executeCommand('workbench.action.editorLayoutTwoRows');
    }

    editor.revealRange(result.range);
    editor.selection = new vscode.Selection(result.range.start, result.range.end);
}
