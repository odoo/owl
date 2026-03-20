import { css as cssLang, javascript, markdown, xml as xmlLang } from "./libs/codemirror.bundle.js";

const LANGUAGES = {
  js: () => javascript(),
  css: () => cssLang(),
  xml: () => xmlLang(),
  md: () => markdown(),
};

const TAB_SIZES = { js: 4, css: 4, xml: 2, md: 2 };

const FILE_ICON_CLASSES = {
  js: "file-icon-js",
  xml: "file-icon-xml",
  css: "file-icon-css",
  md: "file-icon-md",
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getFileType(name) {
  const ext = name.split(".").pop();
  return ext in LANGUAGES ? ext : "js";
}

function makeFileEntry(name) {
  const type = getFileType(name);
  return { name, type, iconClass: FILE_ICON_CLASSES[type] || "" };
}

function parseFilePaths(files) {
  const folders = new Map();
  const rootFiles = [];
  const hiddenFiles = [".gitkeep"];

  for (const file of files) {
    const parts = file.name.split("/");
    if (parts.length === 1) {
      if (!hiddenFiles.includes(file.name)) {
        rootFiles.push(file);
      }
    } else {
      const folderName = parts[0];
      const fileNameInFolder = parts.slice(1).join("/");
      if (!folders.has(folderName)) {
        folders.set(folderName, []);
      }
      if (!hiddenFiles.includes(fileNameInFolder)) {
        folders.get(folderName).push({
          ...file,
          name: fileNameInFolder,
          fullName: file.name,
        });
      }
    }
  }

  const sortedFolders = [...folders.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [, folderFiles] of sortedFolders) {
    folderFiles.sort((a, b) => a.name.localeCompare(b.name));
  }
  rootFiles.sort((a, b) => a.name.localeCompare(b.name));

  return { folders: sortedFolders, rootFiles };
}

export {
  LANGUAGES,
  TAB_SIZES,
  FILE_ICON_CLASSES,
  generateId,
  getFileType,
  makeFileEntry,
  parseFilePaths,
};
