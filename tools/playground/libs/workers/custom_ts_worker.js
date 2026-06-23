/* Inspired from https://github.com/pieterjanv/monaco-editor-module-auto-import-demo */

const customTSWorkerFactory = (TypeScriptWorker) => {
  return class MyTypeScriptWorker extends TypeScriptWorker {

    getCompletionsAtPosition() {
      return undefined;
    }

    getMyCompletionsAtPosition(file, position) {
      const languageService = this.getLanguageService();

      return languageService.getCompletionsAtPosition(file, position, {
        includeCompletionsForModuleExports: true,
        includeCompletionsWithInsertText: true,
      });
    }

    getMyCompletionEntryDetails(file, position, entryName, formatOptions, source, preferences, data) {
      const languageService = this.getLanguageService();
      return languageService.getCompletionEntryDetails(
        file,
        position,
        entryName,
        formatOptions ?? {},
        source,
        { includeCompletionsForModuleExports: true, ...preferences },
        data,
      );
    }
  };
};

self.customTSWorkerFactory = customTSWorkerFactory;
