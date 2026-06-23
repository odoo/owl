import { createHighlighter, shikiToMonaco, oneDarkPro } from "@libs/shiki";

async function loadGrammar(grammar) {
  return await fetch(
    `/playground/libs/grammars/${grammar}`
  ).then(r => r.json());
}

const buildSlateTheme = async () => {
  return {
    ...oneDarkPro,
    name: "slate-dark",
    type: "dark",
    colors: {
      ...oneDarkPro.colors,
      "editor.background": "#243447",
      "editor.foreground": "#ffffff",
      "editor.lineHighlightBackground": "#ffffff08"
    },
    tokenColors: oneDarkPro.tokenColors,
  };
}

export async function setupShiki(monaco) {
  const highlighter = await createHighlighter({
    themes: [
      "github-light",
      await buildSlateTheme(),
    ],

    langs: [
      'typescript', 'javascript', 'xml', 'html', 'css',
      loadGrammar('owl.template.json'),
      loadGrammar('owl.template.inline.json'),
      loadGrammar('owl.markup.inline.json')
    ],
  });

  await shikiToMonaco(highlighter, monaco);

  return highlighter;
}
