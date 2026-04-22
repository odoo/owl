const package = require("../packages/owl/package.json");
const corePackage = require("../packages/owl-core/package.json");
const compilerPackage = require("../packages/owl-compiler/package.json");
const runtimePackage = require("../packages/owl-runtime/package.json");
const packageLock = require("../package-lock.json");
const readline = require("readline");
const fs = require("fs");
const exec = require("child_process").exec;
const chalk = require("chalk");
const branchName = require('current-git-branch');

const REL_NOTES_FILE = `dist/release-notes.md`;
const branch = "master";

// Only the umbrella package is published to npm. The siblings are workspace-
// internal: their code is bundled into @odoo/owl by esbuild.
const SIBLING_PACKAGES = [
  { name: "@odoo/owl-core", path: "packages/owl-core/package.json", pkg: corePackage },
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

  log(`*** Owl release script ***`);
  log(`Current Version: ${package.version}`);
  log(`Warning: this script will push to the master branch!`);
  log(`Make sure that github is configured to allow it:`);
  log(`   settings => branches => edit master => uncheck Do not allow bypassing the above settings`);
  log(`   (and probably a good idea to readd the protection after)`)

  let isAlpha = await ask("Is this an alpha release? [y/n] (n): ");
  isAlpha = isAlpha.toLowerCase() === "y";

  const STEPS = 12;
  let step = 1;
  // ---------------------------------------------------------------------------
  // Authenticate first: handles 2FA in the browser, so the publish at step 12
  // doesn't blow up after everything else has already landed. Requires npm
  // account 2FA mode to be "Authorization only" — if it's "Authorization and
  // writes", publish will still prompt for an OTP on the CLI.
  log(`Step ${step++}/${STEPS}: logging in to npm via browser...`);
  const loginResult = await execCommand("npm login --auth-type=web");
  if (loginResult !== 0) {
    logError("npm login failed. Aborting.");
    return;
  }

  // ---------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: Checking if code formatting is right...`)
  const checkFormatting = await execCommand("npm run check-formatting");
  if (checkFormatting !== 0) {
    logError("Prettier format validation failed. Aborting.");
    return;
  }

  // ---------------------------------------------------------------------------
  log(`Step ${step++}/${STEPS}: collecting info...`);
  const currentVersion = package.version;
  let defaultNext = "";
  if (isAlpha) {
    const alphaMatch = currentVersion.match(/^(.+)-alpha\.(\d+)$/);
    if (alphaMatch) {
      defaultNext = `${alphaMatch[1]}-alpha.${parseInt(alphaMatch[2]) + 1}`;
    }
  }
  let next = await ask(`Next version${defaultNext ? ` (${defaultNext})` : ""}: `);
  next = next || defaultNext;
  if (next[0] === 'v') next = next.substring(1);
  let file = await ask(`Release notes (${REL_NOTES_FILE}): `);
  file = file || REL_NOTES_FILE;
  if (!fs.existsSync(`./${file}`)) {
    const lastRelease = await getOutput("git log --grep='\\[REL\\]' -n 1 --pretty=%H");
    const commitsSinceLastRelease = await getOutput(`git log ${lastRelease.trim()}..HEAD --pretty=%s`);
    const commitsAsMdList = commitsSinceLastRelease.trim().split("\n").map(l => " - " + l).join("\n");
    log(`${file} did not exist, created a template containing all commits since last release.`)
    fs.mkdirSync("dist", { recursive: true });
    fs.writeFileSync(file, `# v${next}\n\n${commitsAsMdList}`);
    const shouldContinue = await ask(`Check that the contents of ${file} is correct, then press y to continue: `);
    if (shouldContinue.toLowerCase() !== "y") {
      log("aborted");
      return;
    }
  }
  let content;
  try {
    content = await readFile("./" + file);
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
  // All four workspaces are bumped in lockstep so versions stay coherent, even
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
  await execCommand("rm -rf packages/owl-core/dist packages/owl-compiler/dist packages/owl-runtime/dist packages/owl/dist");
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
  const prerelease = isAlpha ? "--prerelease" : "";
  const relaseResult = await execCommand(`gh release create v${next} packages/owl/dist/*.js dist/*.zip ${draft} ${prerelease} -F ${file}`);
  if (relaseResult !== 0) {
    logError("github release failed. Aborting.");
    return;
  }

  log(`Step ${step++}/${STEPS}: publishing module on npm...`);
  const npmTag = isAlpha ? "--tag alpha" : "";
  const publishResult = await execCommand(`npm publish ${npmTag} --access public -w packages/owl`);
  if (publishResult !== 0) {
    logError("npm publish failed. The GitHub release succeeded — re-run `npm publish --tag alpha --access public -w packages/owl` once fixed.");
    return;
  }

  // Clean up release notes
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }

  log("Owl Release process completed! Thank you for your patience");
  await execCommand(`gh release view`);
  await execCommand(`gh release view -w`);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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
