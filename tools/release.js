const package = require("../package.json");
const readline = require("readline");
const fs = require("fs");
const exec = require("child_process").exec;
const chalk = require("chalk");
const GitHub = require("github-api");

const REL_NOTES_FILE = `release-notes.md`;
const STEPS = 10;

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
  log(`*** Owl release script ***`);
  log(`Current Version: ${package.version}`);

  // ---------------------------------------------------------------------------
  log(`Step 1/${STEPS}: collecting info...`);
  const current = package.version;
  const next = await ask("Next version: ");
  let file = await ask(`Release notes (${REL_NOTES_FILE}): `);
  file = file || REL_NOTES_FILE;
  let content;
  try {
    content = await readFile("./" + file);
  } catch (e) {
    logSubContent(e.message);
    log("Cannot find release notes... Aborting");
    return;
  }

  // Todo: add playground update feature
  // let shouldUpdateStr = await ask("Update Playground? (y/n)");
  // const shouldUpdatePlayground = shouldUpdateStr === "y";
  const token = await ask("Github token: ");

  // ---------------------------------------------------------------------------
  log(`Step 2/${STEPS}: running tests...`);
  const testsResult = await execCommand("npm run test");
  if (testsResult !== 0) {
    log("Test suite does not pass. Aborting.");
    return;
  }
  await ask("Ready for next step...");

  // ---------------------------------------------------------------------------
  log(`Step 3/${STEPS}: updating package.json, readme.md and roadmap.md...`);
  await replaceInFile("./package.json", current, next);
  await replaceInFile("./README.md", current, next);
  await replaceInFile("./roadmap.md", current, next);
  await ask("Ready for next step...");

  // ---------------------------------------------------------------------------
  log(`Step 4/${STEPS}: creating git commit...`);
  const gitResult = await execCommand(`git commit -am "[REL] v${next}\n\n${content}"`);
  if (gitResult !== 0) {
    log("Git commit failed. Aborting.");
    return;
  }
  await ask("Ready for next step...");

  // -------------------j--------------------------------------------------------
  log(`Step 5/${STEPS}: building owl (iife version)...`);
  const buildResult = await execCommand("npm run build");
  if (buildResult !== 0) {
    log("Build failed. Aborting.");
    return;
  }
  await ask("Ready for next step...");

  // ---------------------------------------------------------------------------
  log(`Step 6/${STEPS}: minifying owl...`);
  const minifyResult = await execCommand("npm run minify");
  if (minifyResult !== 0) {
    log("Minify failed. Aborting.");
    return;
  }
  await ask("Ready for next step...");

  // ---------------------------------------------------------------------------
  log(`Step 7/${STEPS}: pushing on github...`);
  const pushResult = await execCommand("git push");
  if (pushResult !== 0) {
    log("git push failed. Aborting.");
    return;
  }
  await ask("Ready for next step...");

  // ---------------------------------------------------------------------------
  log(`Step 8/${STEPS}: publishing release notes on github...`);
  const options = {
    tag_name: `v${next}`,
    name: `v${next}`,
    body: content,
    draft: true // todo: remove this someday
  };
  const result = await createRelease(token, options);
  await ask("Ready for next step...");

  // ---------------------------------------------------------------------------
  log(`Step 9/${STEPS}: adding assets to release...`);
  await ask("Please add owl.js and owl.min.js to draft release, then confirm");
  // todo: do this with curl
  // curl \
  //   -H "Authorization: token $GITHUB_TOKEN" \
  //   -H "Content-Type: $(file -b --mime-type $FILE)" \
  //   --data-binary @$FILE \
  //   "https://uploads.github.com/repos/hubot/singularity/releases/123/assets?name=$(basename $FILE)"

  // ---------------------------------------------------------------------------
  log(`Step 10/${STEPS}: publishing module on npm...`);
  await execCommand("npm run publish");

  log("Owl Release process completed! Thank you for your patience");
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function log(text) {
  console.log(chalk.yellow(formatLog(text)));
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

async function replaceInFile(file, from, to) {
  const content = await readFile(file);
  return new Promise((resolve, reject) => {
    const updatedContent = content.replace(new RegExp(from, "g"), to);
    fs.writeFile(file, updatedContent, "utf8", err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function createRelease(token, options) {
  return new Promise((resolve, reject) => {
    var gh = new GitHub({ token });
    gh.getRepo("odoo", "owl").createRelease(options, (err, result, req) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}
