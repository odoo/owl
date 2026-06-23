/* Inspired from https://github.com/pieterjanv/monaco-editor-module-auto-import-demo */

import { playgroundAssetUrl } from "../asset_url.js";

let KIND_MAP = null;

const buildKindMap = (monaco) => {
  if (KIND_MAP) return;
  KIND_MAP = {
    class: monaco.languages.CompletionItemKind.Class,
    function: monaco.languages.CompletionItemKind.Function,
    method: monaco.languages.CompletionItemKind.Method,
    property: monaco.languages.CompletionItemKind.Property,
    var: monaco.languages.CompletionItemKind.Variable,
    let: monaco.languages.CompletionItemKind.Variable,
    const: monaco.languages.CompletionItemKind.Variable,
    interface: monaco.languages.CompletionItemKind.Interface,
    type: monaco.languages.CompletionItemKind.Class,
    alias: monaco.languages.CompletionItemKind.Class,
    enum: monaco.languages.CompletionItemKind.Enum,
    module: monaco.languages.CompletionItemKind.Module,
    keyword: monaco.languages.CompletionItemKind.Keyword,
    constructor: monaco.languages.CompletionItemKind.Constructor,
  };
}

function mapKind(monaco, tsKind) {
  return KIND_MAP[tsKind] ?? monaco.languages.CompletionItemKind.Variable;
}

function fileChangesToEdits(monaco, model, fileName, changes) {
  const fileChange = changes.find((c) => c.fileName === fileName);
  if (!fileChange) return [];

  return fileChange.textChanges.map((tc) => {
    const startPos = model.getPositionAt(tc.span.start);
    const endPos = model.getPositionAt(tc.span.start + tc.span.length);
    return {
      range: new monaco.Range(
        startPos.lineNumber, startPos.column,
        endPos.lineNumber, endPos.column,
      ),
      text: tc.newText,
    };
  });
}

let providerDisposable = null;

export const registerCustomTsWorker = async (monaco) => {
  buildKindMap(monaco);
  monaco.typescript.javascriptDefaults.setWorkerOptions({
    customWorkerPath: playgroundAssetUrl("./libs/workers/custom_ts_worker.js"),
  });

  const getWorker = await monaco.typescript.getJavaScriptWorker();

  providerDisposable?.dispose();

  providerDisposable = monaco.languages.registerCompletionItemProvider("javascript", {
    triggerCharacters: [".", '"', "'", "`", "/", "@", "<"],

    async provideCompletionItems(model, position) {
      const worker = await getWorker(model.uri);
      const fileName = model.uri.toString();

      const completions = await worker.getMyCompletionsAtPosition(
        fileName,
        model.getOffsetAt(position),
      );

      const wordInfo = model.getWordUntilPosition(position);
      const defaultRange = new monaco.Range(
        position.lineNumber, wordInfo.startColumn,
        position.lineNumber, wordInfo.endColumn,
      );

      const suggestions = (completions?.entries ?? []).map((completion) => {
        let range = defaultRange;

        if (completion.replacementSpan) {
          const startPosition = model.getPositionAt(completion.replacementSpan.start);
          const endPosition = model.getPositionAt(
            completion.replacementSpan.start + completion.replacementSpan.length
          );
          range = new monaco.Range(
            startPosition.lineNumber, startPosition.column,
            endPosition.lineNumber, endPosition.column,
          );
        }

        const needsImport = completion.hasAction === true;

        return {
          label: {
            label: completion.name,
            description: needsImport ? completion.source : undefined,
          },
          kind: mapKind(monaco, completion.kind),
          insertText: completion.insertText ?? completion.name,
          sortText: completion.sortText,
          range,
          _tsEntry: completion,
          _fileName: fileName,
          _position: model.getOffsetAt(position),
        };
      });

      return { suggestions, incomplete: true };
    },

    async resolveCompletionItem(item, token) {
      const completion = item._tsEntry;

      if (!completion?.hasAction) {
        return item;
      }

      const worker = await getWorker(monaco.Uri.parse(item._fileName));
      const details = await worker.getMyCompletionEntryDetails(
        item._fileName,
        item._position,
        completion.name,
        undefined,
        completion.source,
        undefined,
        completion.data,
      );

      const model = monaco.editor.getModel(monaco.Uri.parse(item._fileName));

      if (details?.codeActions?.length && model) {
        const edits = details.codeActions.flatMap((action) =>
          fileChangesToEdits(monaco, model, item._fileName, action.changes)
        );
        if (edits.length) {
          item.additionalTextEdits = edits;
        }
      }

      if (details?.documentation) {
        item.documentation = details.documentation.map((d) => d.text).join("\n");
      }

      return item;
    },
  });
};
