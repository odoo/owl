import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GRAMMAR_DIR = path.resolve(
  __dirname,
  "./owl-vision/syntaxes"
);

const SHIKI_CONFIG = {
  "owl.template.json": {
    name: "owl-template",
    embeddedLangs: ["javascript"],
    injectTo: [
      "text.xml",
    ],
  },

  "owl.template.inline.json": {
    name: "owl-template-inline",
    embeddedLangs: ["xml"],
    injectTo: [
      "source.js",
      "source.ts",
      "text.html",
    ],
  },

  "owl.markup.inline.json": {
    name: "owl-markup-inline",
    embeddedLangs: ["html"],
    injectTo: [
      "source.js",
      "source.ts",
      "text.html",
    ],
  },
};

function loadGrammar(filename) {
  const grammar = JSON.parse(
    fs.readFileSync(
      path.join(GRAMMAR_DIR, filename),
      "utf8"
    )
  );

  const config = SHIKI_CONFIG[filename];

  return {
    ...grammar,
    name: config.name,
    embeddedLangs: config.embeddedLangs,
    injectTo: config.injectTo,
  };
}

export function getShikiGrammars() {
  return Object.keys(SHIKI_CONFIG).map(loadGrammar);
}

export function writeShikiGrammars(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  for (const grammar of getShikiGrammars()) {
    fs.writeFileSync(
      path.join(outputDir, `${grammar.scopeName}.json`),
      JSON.stringify(grammar, null, 2),
      "utf8"
    );
  }
}
