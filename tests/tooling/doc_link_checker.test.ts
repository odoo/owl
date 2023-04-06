/**
 * Doc Link Checker
 *
 * We define here a test to make sure that there are no dead link in the Owl
 * documentation.
 */
import * as fs from "fs";

//--------------------------------------------------------------------------
// Helpers
//--------------------------------------------------------------------------

interface MarkDownLink {
  name: string;
  link: string;
}

interface MarkDownSection {
  name: string;
  slug: string;
}

interface FileData {
  name: string;
  path: string[];
  fullName: string;
  links: MarkDownLink[];
  sections: MarkDownSection[];
}

const LINK_REGEXP = /\[([^\[]+)\]\(([^\)]+)\)/g;
const HEADING_REGEXP = /\n(#+\s*)(.*)/g;

export function addMarkdownData(fileData: FileData): void {
  const sep = fileData.path.length > 0 ? "/" : "";
  const fullName = fileData.path.join("/") + sep + fileData.name;
  const content = fs.readFileSync(fullName, { encoding: "utf8" });
  let m;
  // get links info
  do {
    m = LINK_REGEXP.exec(content);
    if (m) {
      fileData.links.push({ name: m[0], link: m[2] });
    }
  } while (m);
  // get sections info
  do {
    m = HEADING_REGEXP.exec(content);
    if (m) {
      fileData.sections.push({ name: m[0], slug: slugify(m[2]) });
    }
  } while (m);
}

/**
 * Returns a list of FileData corresponding to all files that need to be
 * validated.
 */
function getFiles(path: string[] = []): FileData[] {
  if (path.length === 0) {
    const baseFiles: FileData[] = [
      { name: "README.md", path: [], links: [], sections: [], fullName: "README.md" },
      { name: "CHANGELOG.md", path: [], links: [], sections: [], fullName: "CHANGELOG.md" },
      { name: "roadmap.md", path: [], links: [], sections: [], fullName: "roadmap.md" },
    ];
    const rest = getFiles(["doc"]);
    const result = baseFiles.concat(rest);
    result.forEach(addMarkdownData);
    return result;
  }
  const files = fs.readdirSync(path.join("/"), { withFileTypes: true }).map((f) => {
    if (f.isDirectory()) {
      return getFiles(path.concat(f.name));
    }
    const fullName = path.join("/") + (path.length > 0 ? "/" : "") + f.name;
    return [
      {
        name: f.name,
        path,
        links: [],
        sections: [],
        fullName,
      },
    ];
  });
  return Array.prototype.concat(...files);
}

const LOCAL_FILES = ["LICENSE"];
export function isLinkValid(link: MarkDownLink, current: FileData, files: FileData[]): boolean {
  if (link.link.startsWith("http")) {
    // no check on external links
    return true;
  }
  if (current.name.endsWith(".png")) {
    // no check on png files
    return true;
  }
  // Step 1: extract path, name, hash
  //      path = ['doc', 'architecture]
  //      name = 'rendering.md'
  //      hash = 'blabla' (or '' if no hash)

  const parts = link.link.split("#");
  const hash = parts[1] || "";
  let name;
  let path;
  if (parts[0]) {
    let temp = parts[0].split("/");
    name = temp[temp.length - 1];
    temp.splice(-1);
    path = current.path.slice();
    for (let elem of temp) {
      if (elem === "..") {
        path.splice(-1);
      } else if (elem !== ".") {
        path.push(elem);
      }
    }
  } else {
    // there are no file name, so this is a relative link to the current file
    name = current.name;
    path = current.path;
  }

  // Step 2: build normalized link file name
  const linkFullName = path.join("/") + (path.length > 0 ? "/" : "") + name;

  // Step 3: check link name against white list of local files
  if (LOCAL_FILES.includes(linkFullName)) {
    return true;
  }

  // Step 4: check if there is a matching file
  let target: FileData | undefined = files.find((f) => f.fullName === linkFullName);
  if (!target) {
    return false;
  }

  // Step 5: if necessary, check if there is a corresponding link inside the target
  // link name
  if (hash) {
    if (!target.sections.find((s) => s.slug === hash)) {
      return false;
    }
  }

  return true;
}

// adapted from https://medium.com/@mhagemann/the-ultimate-way-to-slugify-a-url-string-in-javascript-b8e4a0d849e1
function slugify(str: string): string {
  const a = "àáäâãåăæçèéëêǵḧìíïîḿńǹñòóöôœøṕŕßśșțùúüûǘẃẍÿź·_,:;";
  const b = "aaaaaaaaceeeeghiiiimnnnooooooprssstuuuuuwxyz-----";
  const p = new RegExp(a.split("").join("|"), "g");
  return str
    .toString()
    .toLowerCase()
    .replace(/\//g, "") // remove /
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(p, (c) => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, "-and-") // Replace & with ‘and’
    .replace(/[^\w\-]+/g, "") // Remove all non-word characters
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

//--------------------------------------------------------------------------
// Test
//--------------------------------------------------------------------------

test("All markdown links work", () => {
  let linkNumber = 0;
  let invalidLinkNumber = 0;
  const data = getFiles();
  for (let file of data) {
    for (let link of file.links) {
      linkNumber++;
      if (!isLinkValid(link, file, data)) {
        console.warn(`Invalid Link: "${link.name}" in "${file.name}"`);
        invalidLinkNumber++;
      }
    }
  }
  expect(invalidLinkNumber).toBe(0);
  expect(linkNumber).toBeGreaterThan(10);
});
