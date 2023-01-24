const fs = require("fs");
const path = require("path");
const jsdom = require("jsdom");

// -----------------------------------------------------------------------------
// add global DOM stuff for compiler
// -----------------------------------------------------------------------------
var document = new jsdom.JSDOM("", {});
var window = document.window;
global.document = window.document;
global.window = window;
global.DOMParser = window.DOMParser;
global.Element = window.Element;
global.Node = window.Node;
// this needs to be below the jsdom stuff
const { compile } = require("../dist/compiler.js");

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
async function getXmlFiles(dir) {
  let xmls = [];
  const files = await fs.promises.readdir(dir);
  const filesStats = await Promise.all(files.map((file) => fs.promises.stat(path.join(dir, file))));
  for (let i in files) {
    const name = path.join(dir, files[i]);
    if (filesStats[i].isDirectory()) {
      xmls = xmls.concat(await getXmlFiles(name));
    } else {
      if (name.endsWith(".xml")) {
        xmls.push(name);
      }
    }
  }
  return xmls;
}

function writeToFile(filepath, data) {
  if (!fs.existsSync(path.dirname(filepath))) {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
  }
  fs.writeFile(filepath, data, (err) => {
    if (err) {
      process.stdout.write(`Error while writing file ${filepath}: ${err}`);
      return;
    }
  });
}

// adapted from https://medium.com/@mhagemann/the-ultimate-way-to-slugify-a-url-string-in-javascript-b8e4a0d849e1
const a = "·-_,:;";
const p = new RegExp(a.split("").join("|"), "g");

function slugify(str) {
  return str
    .replace(/\//g, "") // remove /
    .replace(/\./g, "_") // Replace . with _
    .replace(p, (c) => '_') // Replace special characters
    .replace(/&/g, "_and_") // Replace & with ‘and’
    .replace(/[^\w\-]+/g, "") // Remove all non-word characters
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------

async function compileTemplates(files) {
  process.stdout.write(`Processing ${files.length} files`);
  let xmlStrings = await Promise.all(files.map((file) => fs.promises.readFile(file, "utf8")));

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
        template.removeAttribute("owl")
      }
      const fnName = slugify(name);
      try {
        const fn = compile(template).toString().replace('anonymous', fnName);
        templates.push(`owl.App.registerTemplate("${name}", ${fn});\n`);
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

  return templates.join("\n");
}

const templatesPath = process.argv[2];
if (templatesPath && templatesPath.length) {
  getXmlFiles(templatesPath).then(async (files) => {
    const result = await compileTemplates(files);
    writeToFile("templates.js", result);
  });
} else {
  console.log("Please provide a path");
}
