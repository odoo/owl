const package = require("../package.json");
const readline = require("readline");
const fs = require("fs");
const exec = require("child_process").exec;
const chalk = require("chalk");
const branchName = require('current-git-branch');

const REL_NOTES_FILE = `release-notes.md`;
const STEPS = 8;
const branch = "master";

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
  
  log("Check if code formatting is right...")
  const checkFormatting = await execCommand("npm run check-formatting");
  if (checkFormatting !== 0) {
    logError("Prettier format validation failed. Aborting.");
    return;
  }

  log(`*** Owl release script ***`);
  log(`Current Version: ${package.version}`);

  // ---------------------------------------------------------------------------
  log(`Step 1/${STEPS}: collecting info...`);
  const current = package.version;
  let next = await ask("Next version: ");
  if (next[0] === 'v') next = next.substring(1);
  let file = await ask(`Release notes (${REL_NOTES_FILE}): `);
  file = file || REL_NOTES_FILE;
  let content;
  if (!fs.existsSync(`./${file}`)) {
    let lastRelease = await getOutput("git log --grep='\\[REL\\]' -n 1 --pretty=%H");
    const commitsSinceLastRelease = await getOutput(`git log ${lastRelease.trim()}..HEAD --pretty=%s`);
    const commitsAsMdList = commitsSinceLastRelease.trim().split("\n").map(l => " - " + l).join("\n");
    log(`${file} did not exist, created a template containing all commits since last release.`)
    fs.writeFileSync(file, `# v${next}\n\n${commitsAsMdList}`);
    const shouldContinue = await ask(`Check that the contents of ${file} is correct, then press y to continue: `);
    if (shouldContinue.toLowerCase() !== "y") {
      log("aborted");
      return;
    }
  }
  try {
    content = await readFile("./" + file);
  } catch (e) {
    logSubContent(e.message);
    logError("Cannot find release notes... Aborting");
    return;
  }
  let shouldBeDraft = await ask(`Should be a draft [y/n] ? (n)`);
  let draft = ""
  if (shouldBeDraft.toLowerCase() === 'y')
  {
    draft = "--draft";
  }
  let shouldUploadPlayground = await ask(`Should this release be uploaded on the playground [y/n] ? (y)`);
  shouldUploadPlayground = shouldUploadPlayground.toLowerCase() !== 'n';

  // ---------------------------------------------------------------------------
  log(`Step 2/${STEPS}: running tests...`);
  const testsResult = await execCommand("npm run test");
  if (testsResult !== 0) {
    logError("Test suite does not pass. Aborting.");
    return;
  }

  // ---------------------------------------------------------------------------
  log(`Step 3/${STEPS}: updating package.json...`);
  await replaceInFile("./package.json", current, next);
  await replaceInFile("./src/version.ts", current, next);

  // ---------------------------------------------------------------------------
  log(`Step 4/${STEPS}: creating git commit...`);
  const escapedContent = content.replace(/\"/g, '\\\"').replace(/\`/g, '\\\`');
  const gitResult = await execCommand(`git commit -am "[REL] v${next}\n\n${escapedContent}"`);
  if (gitResult !== 0) {
    logError("Git commit failed. Aborting.");
    return;
  }

  // ----------------------------------------------------------------------------
  log(`Step 5/${STEPS}: building owl...`);
  await execCommand("rm -rf dist/");
  const buildResult = await execCommand("npm run build");
  if (buildResult !== 0) {
    logError("Build failed. Aborting.");
    return;
  }

  // ---------------------------------------------------------------------------
  log(`Step 6/${STEPS}: pushing on github...`);
  const pushResult = await execCommand("git push origin " + branch);
  if (pushResult !== 0) {
    logError("git push failed. Aborting.");
    return;
  }

  // ---------------------------------------------------------------------------

  log(`Step 7/${STEPS}: Creating the release...`);
  const relaseResult = await execCommand(`gh release create v${next} dist/*.js ${draft} -F ${file}`);
  if (relaseResult !== 0) {
    logError("github release failed. Aborting.");
    return;
  }

  log(`Step 8/${STEPS}: publishing module on npm...`);
  await execCommand("npm run publish");

  log("Owl Release process completed! Thank you for your patience");
  await execCommand(`gh release view`);
  await execCommand(`gh release view -w`);

  if (shouldUploadPlayground) {
    log(`Bonus step: publishing new release on playground...`);
    let owl_code = null;
    let status = 0

    try {
      owl_code = await readFile("dist/owl.iife.js");
    } catch (e) {
      logSubContent(e.message);
      logError("Cannot read owl.iife.js... Aborting");
      return;
    }

    status |= await execCommand("git checkout gh-pages");
    status |= await execCommand("git pull --rebase");
    
    if (status !== 0) {
      logError("Couldn't switch to gh-pages branch")
      return;
    }

    try {
      fs.writeFileSync('owl.js', owl_code)
    } catch (err) {
      logError(err)
      return;
    }
    
    status |= await execCommand(`git commit -am "[IMP] update owl to v${next}"`);
    status |= await execCommand(`git push origin gh-pages`);
    status |= await execCommand("git checkout -");
    if (status !== 0) {
      logError("Something went wrong for the playground update.")
    }
  }
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
