import { registerXmlTagRename } from "./xml_tag_rename.js";
import { registerOwlSnippets } from "./snippets.js";
import { setupShiki } from "./shiki.js";
import { registerCustomTsWorker } from "./auto_import.js";
import { playgroundAssetUrl } from "../asset_url.js";

let monacoInitialized = false;

export async function initiateMonaco(monaco) {
    if (monacoInitialized) {
        return;
    }
    window.MonacoEnvironment = {
        getWorker(_, label) {
            switch (label) {
                case "typescript":
                case "javascript":
                    return new Worker(
                        playgroundAssetUrl("./libs/workers/ts.worker.js")
                    );

                case "css":
                    return new Worker(
                        playgroundAssetUrl("./libs/workers/css.worker.js")
                    );

                case "html":
                    return new Worker(
                        playgroundAssetUrl("./libs/workers/html.worker.js")
                    );

                default:
                    return new Worker(
                        playgroundAssetUrl("./libs/workers/editor.worker.js")
                    );
            };
        },
    };
    monaco.typescript.javascriptDefaults.setCompilerOptions({
        allowJs: true,
        allowNonTsExtensions: true,
        checkJs: true,
        noImplicitAny: false,
        moduleResolution:
            monaco.typescript.ModuleResolutionKind.NodeJs,
        module:
            monaco.typescript.ModuleKind.ESNext,
        target:
            monaco.typescript.ScriptTarget.ESNext,
        baseUrl: "file:///",
    });
    monaco.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
    });
    monaco.typescript.javascriptDefaults.addExtraLib(
        `declare const TEMPLATES: Record<string, string>;`,
        "file:///globals.d.ts"
    );
    registerOwlSnippets(monaco);
    registerXmlTagRename(monaco);
    await registerCustomTsWorker(monaco);
    await setupShiki(monaco);
    monacoInitialized = true;
}
