// -----------------------------------------------------------------------------
// This file exports a function that allows compiling templates ahead of time.
// It is used by the "compile_owl_template" command registered in the "bin"
// section of owl's package.json
// -----------------------------------------------------------------------------

import { watch } from "fs";
import { readdir, readFile, rename, stat, writeFile } from "fs/promises";
import path from "path";
import "./setup_jsdom";
// Compiler imports must be made after setting up jsdom in the global namespace
import { compile } from "..";

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
async function getXmlFiles(paths: string[]): Promise<string[]> {
  return (
    await Promise.all(
      paths.map(async (file) => {
        const stats = await stat(path.join(file));
        if (stats.isDirectory()) {
          return await getXmlFiles(
            (await readdir(file)).map((fileName) => path.join(file, fileName))
          );
        }
        if (file.endsWith(".xml")) {
          return file;
        }
        return [];
      })
    )
  ).flat();
}

// adapted from https://medium.com/@mhagemann/the-ultimate-way-to-slugify-a-url-string-in-javascript-b8e4a0d849e1
const a = "·-_,:;";
const p = new RegExp(a.split("").join("|"), "g");

function slugify(str: string) {
  return str
    .replace(/\//g, "") // remove /
    .replace(/\./g, "_") // Replace . with _
    .replace(p, (c) => "_") // Replace special characters
    .replace(/&/g, "_and_") // Replace & with ‘and’
    .replace(/[^\w\-]+/g, ""); // Remove all non-word characters
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------

export async function compileTemplates(paths: string[]) {
  const files = await getXmlFiles(paths);
  process.stdout.write(`Processing ${files.length} files`);
  let xmlStrings = await Promise.all(files.map((file) => readFile(file, "utf8")));

  const templates = [];
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const fileContent = xmlStrings[i];
    process.stdout.write(`.`);
    const parser = new DOMParser();
    const doc = parser.parseFromString(fileContent, "text/xml");
    for (const template of doc.querySelectorAll("[t-name]")) {
      const name = template.getAttribute("t-name");
      if (template.hasAttribute("owl")) {
        template.removeAttribute("owl");
      }
      const fnName = slugify(name!);
      try {
        const fn = compile(template).toString().replace("anonymous", fnName);
        templates.push(`"${name}": ${fn},\n`);
      } catch (e) {
        errors.push({ name, fileName, e });
      }
    }
  }
  process.stdout.write(`\n`);

  for (let { name, fileName, e } of errors) {
    console.warn(`Error while compiling '${name}' (in file ${fileName})`);
    console.error(e);
  }
  console.log(`${templates.length} templates compiled`);

  return `export const templates = {\n ${templates.join("\n")} \n}`;
}

// -----------------------------------------------------------------------------
// watch mode
// -----------------------------------------------------------------------------

async function compileAndWrite(paths: string[], outputPath: string) {
  const result = await compileTemplates(paths);
  const tmp = `${outputPath}.tmp`;
  await writeFile(tmp, result);
  await rename(tmp, outputPath);
}

export async function watchAndCompile(paths: string[], outputPath: string) {
  await compileAndWrite(paths, outputPath);

  let timer: NodeJS.Timeout | null = null;
  let pending = false;
  const schedule = () => {
    pending = true;
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      while (pending) {
        pending = false;
        try {
          await compileAndWrite(paths, outputPath);
        } catch (e) {
          console.error(e);
        }
      }
    }, 50);
  };

  const resolvedOutput = path.resolve(outputPath);
  for (const p of paths) {
    watch(p, { recursive: true }, (_event, filename) => {
      if (!filename || !filename.endsWith(".xml")) return;
      const changed = path.resolve(p, filename);
      if (changed === resolvedOutput) return;
      schedule();
    });
  }

  console.log(`Watching ${paths.join(", ")} for .xml changes...`);
  await new Promise(() => {});
}
