const package = require("../packages/owl/package.json");
const corePackage = require("../packages/owl-core/package.json");
const blockdomPackage = require("../packages/owl-blockdom/package.json");
const compilerPackage = require("../packages/owl-compiler/package.json");
const runtimePackage = require("../packages/owl-runtime/package.json");
const packageLock = require("../package-lock.json");
const readline = require("readline");
const fs = require("fs");
const { exec, spawn } = require("child_process");
const chalk = require("chalk");
const branchName = require('current-git-branch');

const REL_NOTES_FILE = `dist/release-notes.md`;
const branch = "master";
const RELEASE_TYPES = ["alpha", "beta", "stable"];

// Only the umbrella package is published to npm. The siblings are workspace-
// internal: their code is bundled into @odoo/owl by esbuild.
const SIBLING_PACKAGES = [
  { name: "@odoo/owl-core", path: "packages/owl-core/package.json", pkg: corePackage },
  { name: "@odoo/owl-blockdom", path: "packages/owl-blockdom/package.json", pkg: blockdomPackage },
  { name: "@odoo/owl-compiler", path: "packages/owl-compiler/package.json", pkg: compilerPackage },
  { name: "@odoo/owl-runtime", path: "packages/owl-runtime/package.json", pkg: runtimePackage },
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

startRelease().then(() => {
  rl.close();
});

// -----------------------------------------------------------------------------
// Relase Script
// -----------------------------------------------------------------------------

async function startRelease() {
  // First check we are on master
  if (branchName() !== branch) {
    logError(`You shall not pass! You are not on the ${branch} branch!`)
    return;
  }

  // The GitHub release and the npm publish are the last steps, after the
  // push: check both logins before doing anything.
  let githubUser;
  try {
    githubUser = (await getOutput("gh api user --jq .login")).trim();
  } catch (e) {
    logError("You are not logged in to GitHub. Run `gh auth login`, then try again.");
    return;
  }
  let npmUser;
  try {
    npmUser = (await getOutput("npm whoami")).trim();
  } catch (e) {
    logError("You are not logged in to npm. Run `npm login`, then try again.");
    return;
  }

  log(`*** Owl release script ***`);
  log(`Current Version: ${package.version}`);
  log(`Logged in to GitHub as: ${githubUser}`);
  log(`Logged in to npm as: ${npmUser}`);
  log(`Warning: this script will push to the master branch!`);
  log(`Make sure that github is configured to allow it:`);
  log(`   settings => branches => edit master => uncheck Do not allow bypassing the above settings`);
  log(`   (and probably a good idea to readd the protection after)`)

  // defaults to the type of the current version
  const currentType = getReleaseType(package.version);
  let releaseType = await ask(`Release type [${RELEASE_TYPES.join("/")}] (${currentType}): `);
  releaseType = releaseType.toLowerCase() || currentType;
  if (!RELEASE_TYPES.includes(releaseType)) {
    logError(`Unknown release type: ${releaseType}. Aborting.`);
    return;
  }
  // alpha and beta releases are GitHub prereleases, published on npm under
  // their own tag, so that they do not replace the "latest" version
  const isPrerelease = releaseType !== "stable";

  const STEPS = 11;
  let step = 1;
  // ---------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: Checking if code formatting is right...`)
  const checkFormatting = await execCommand("npm run check-formatting");
  if (checkFormatting !== 0) {
    logError("Prettier format validation failed. Aborting.");
    return;
  }

  // ---------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: collecting info...`);
  const defaultNext = getDefaultNextVersion(package.version, releaseType);
  let next = await ask(`Next version${defaultNext ? ` (${defaultNext})` : ""}: `);
  next = next || defaultNext;
  if (next[0] === 'v') next = next.substring(1);
  if (getReleaseType(next) !== releaseType || !/^\d+\.\d+\.\d+(-(alpha|beta)\.\d+)?$/.test(next)) {
    logError(`"${next}" is not a valid ${releaseType} version. Aborting.`);
    return;
  }
  // The release notes are always generated from the commits since the last
  // release (overwriting the file of a previous run), and written to a file
  // so that they can be edited before confirming.
  const lastRelease = await getOutput("git log --grep='\\[REL\\]' -n 1 --pretty=%H");
  const commitsSinceLastRelease = await getOutput(`git log ${lastRelease.trim()}..HEAD --pretty=%s`);
  const commitsAsMdList = commitsSinceLastRelease.trim().split("\n").filter(Boolean).map(l => " - " + l).join("\n");
  fs.mkdirSync("dist", { recursive: true });
  fs.writeFileSync(REL_NOTES_FILE, `# v${next}\n\n${commitsAsMdList}\n`);
  log(`Release notes (${REL_NOTES_FILE}):`);
  logSubContent(fs.readFileSync(REL_NOTES_FILE, "utf8"));
  const confirmNotes = await ask(`Edit ${REL_NOTES_FILE} if needed, then confirm [Y/n]: `);
  if (confirmNotes.toLowerCase() === "n") {
    log("aborted");
    return;
  }
  let content;
  try {
    // read again: the file may have been edited
    content = await readFile(REL_NOTES_FILE);
  } catch (e) {
    logSubContent(e.message);
    logError("Cannot find release notes... Aborting");
    return;
  }
  let shouldBeDraft = await ask(`Should be a draft [y/n] ? (n)`);
  let draft = ""
  if (shouldBeDraft.toLowerCase() === 'y') {
    draft = "--draft";
  }

  // ---------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: running tests...`);
  const testsResult = await execCommand("npm run test");
  if (testsResult !== 0) {
    logError("Test suite does not pass. Aborting.");
    return;
  }

  // ---------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: updating package.json files...`);
  // All workspaces are bumped in lockstep so versions stay coherent, even
  // though only @odoo/owl is published right now.
  for (const sibling of SIBLING_PACKAGES) {
    await writeFile(sibling.path, JSON.stringify({ ...sibling.pkg, version: next }, null, 2) + "\n");
  }
  // @odoo/owl's package.json: bump version, pin sibling devDeps to the new
  // version so the published tarball names the exact matching sources.
  const owlUpdated = { ...package, version: next };
  if (owlUpdated.devDependencies) {
    for (const { name } of SIBLING_PACKAGES) {
      if (name in owlUpdated.devDependencies) {
        owlUpdated.devDependencies[name] = next;
      }
    }
  }
  await writeFile("packages/owl/package.json", JSON.stringify(owlUpdated, null, 2) + "\n");
  await writeFile("package-lock.json", JSON.stringify({ ...packageLock, version: next }, null, 2) + "\n");
  // Regenerate the lockfile's per-workspace entries from the new package.json
  // files (top-level version was set above so the shape stays stable).
  const lockRefresh = await execCommand("npm install --package-lock-only");
  if (lockRefresh !== 0) {
    logError("Lockfile refresh failed. Aborting.");
    return;
  }
  // owl-runtime owns the runtime `version` export; owl re-exports it via
  // `export * from "@odoo/owl-runtime"`.
  await writeFile("./packages/owl-runtime/src/version.ts", `// do not modify manually. This file is generated by the release script.\nexport const version = "${next}";\n`);

  // ---------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: building owl...`);
  await execCommand("rm -rf packages/owl-core/dist packages/owl-blockdom/dist packages/owl-compiler/dist packages/owl-runtime/dist packages/owl/dist");
  const buildResult = await execCommand("npm run build");
  if (buildResult !== 0) {
    logError("Build failed. Aborting.");
    return;
  }

  // ---------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: building type declarations...`);
  const typesResult = await execCommand("npm run build:types");
  if (typesResult !== 0) {
    logError("Type generation failed. Aborting.");
    return;
  }

  // ----------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: building devtools...`);
  const chromeResult = await execCommand("npm run build:devtools-chrome");
  if (chromeResult !== 0) {
    logError("Build devtools chrome failed. Aborting.");
    return;
  }
  await execCommand("mv dist/devtools dist/devtools-chrome");
  const firefoxResult = await execCommand("npm run build:devtools-firefox");
  if (firefoxResult !== 0) {
    logError("Build devtools firefox failed. Aborting.");
    return;
  }
  await execCommand("mv dist/devtools dist/devtools-firefox");
  await execCommand("cd dist && zip -r owl-devtools.zip devtools-chrome devtools-firefox && cd ..");
  await execCommand("rm -r dist/devtools-chrome dist/devtools-firefox");

  // ---------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: creating git commit...`);
  const escapedContent = content.replace(/\"/g, '\\\"').replace(/\`/g, '\\\`');
  const gitResult = await execCommand(`git commit -am "[REL] v${next}\n\n${escapedContent}"`);
  if (gitResult !== 0) {
    logError("Git commit failed. Aborting.");
    return;
  }

  // ---------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: pushing on github...`);
  const pushResult = await execCommand("git push origin " + branch);
  if (pushResult !== 0) {
    logError("git push failed. Aborting.");
    return;
  }

  // ---------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: Creating the release...`);
  const prerelease = isPrerelease ? "--prerelease" : "";
  const relaseResult = await execCommand(`gh release create v${next} packages/owl/dist/*.js packages/owl/dist/owl.llm.md packages/owl/dist/types/owl.d.ts dist/*.zip ${draft} ${prerelease} -F ${REL_NOTES_FILE}`);
  if (relaseResult !== 0) {
    logError("github release failed. Aborting.");
    return;
  }

  log(`Step ${step++}/${STEPS}: publishing module on npm...`);
  const npmTag = isPrerelease ? ` --tag ${releaseType}` : "";
  const publishCommand = `npm publish${npmTag} --access public -w packages/owl`;
  // npm asks for a one-time password (in the browser, or typed in) when the
  // account uses 2FA, which needs the terminal. No question is asked after
  // this point: close the prompt so that it does not read the input meant for
  // npm.
  rl.close();
  const publishResult = await execInTerminal(publishCommand);
  if (publishResult !== 0) {
    logError(`npm publish failed. The GitHub release succeeded — re-run \`${publishCommand}\` once fixed.`);
    return;
  }

  // Clean up release notes
  if (fs.existsSync(REL_NOTES_FILE)) {
    fs.unlinkSync(REL_NOTES_FILE);
  }

  log("Owl Release process completed! Thank you for your patience");
  await execCommand(`gh release view`);
  await execCommand(`gh release view -w`);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getReleaseType(version) {
  const match = version.match(/-(alpha|beta)\.\d+$/);
  return match ? match[1] : "stable";
}

/**
 * 3.0.0-alpha.50 => 3.0.0-alpha.51 (alpha), 3.0.0-beta.1 (beta), 3.0.0 (stable)
 * 3.0.0-beta.2 => 3.0.0-beta.3 (beta), 3.0.0 (stable)
 * No default otherwise: the next stable version must be typed in.
 */
function getDefaultNextVersion(current, releaseType) {
  const match = current.match(/^(.+)-(alpha|beta)\.(\d+)$/);
  if (!match) {
    return "";
  }
  const [, base, type, n] = match;
  if (releaseType === type) {
    return `${base}-${type}.${parseInt(n) + 1}`;
  }
  if (releaseType === "beta" && type === "alpha") {
    return `${base}-beta.1`; // like 2.0.0: betas start at 1
  }
  if (releaseType === "stable") {
    return base;
  }
  return "";
}

function log(text) {
  console.log(chalk.yellow(formatLog(text)));
}

function logError(text) {
  console.log(chalk.red(formatLog(text)));
}

function formatLog(text) {
  return `[REL] ${text}`;
}

function logSubContent(text) {
  for (let line of text.split("\n")) {
    if (line.trim()) {
      console.log("    " + line);
    }
  }
}

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, result => {
      resolve(result);
    });
  });
}

function logStream(stream) {
  stream.on("data", data => {
    logSubContent(data);
  });
}

// Runs a command attached to the terminal, for commands that may prompt.
function execInTerminal(command) {
  return new Promise(resolve => {
    const childProcess = spawn(command, { shell: true, stdio: "inherit" });
    childProcess.on("error", () => resolve(1));
    childProcess.on("exit", code => resolve(code));
  });
}

function execCommand(command) {
  return new Promise(resolve => {
    const childProcess = exec(command, (err, stdout, stderr) => {
      if (err) {
        resolve(err.code);
      }
    });
    childProcess.on("exit", code => {
      resolve(code);
    });
    logStream(childProcess.stdout);
    logStream(childProcess.stderr);
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    fs.readFile(file, "utf8", function(err, content) {
      if (err) {
        reject(err);
      } else {
        resolve(content);
      }
    });
  });
}

function writeFile(file, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, content, "utf8", err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function getOutput(command) {
  return new Promise((resolve, reject) => {
    const childProcess = exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      }
      resolve(stdout);
    });
    childProcess.on("exit", code => {
      if (code !== 0) {
        reject(code);
      }
    });
  });
}
