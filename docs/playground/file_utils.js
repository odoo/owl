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

/**
 * Parses a flat list of file entries into a recursive tree of folders and files.
 *
 * Returns: { folders: [[name, { path, folders, files }], ...], files: [...] }
 *  - folders: sorted array of [folderName, subtree] pairs
 *  - files: sorted array of file entries at this level (with fullName)
 */
function parseFilePaths(files) {
  const hiddenFiles = [".gitkeep"];

  function buildTree(fileList, prefix) {
    const folderMap = new Map();
    const localFiles = [];

    for (const file of fileList) {
      const parts = file.name.split("/");
      if (parts.length === 1) {
        if (!hiddenFiles.includes(file.name)) {
          localFiles.push({ ...file, fullName: prefix + file.name });
        }
      } else {
        const folderName = parts[0];
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, []);
        }
        const rest = parts.slice(1).join("/");
        if (!hiddenFiles.includes(rest)) {
          folderMap.get(folderName).push({
            ...file,
            name: rest,
          });
        }
      }
    }

    const folders = [...folderMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, children]) => {
        const folderPath = prefix + name;
        return [name, { path: folderPath, ...buildTree(children, folderPath + "/") }];
      });

    localFiles.sort((a, b) => a.name.localeCompare(b.name));

    return { folders, files: localFiles };
  }

  return buildTree(files, "");
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
