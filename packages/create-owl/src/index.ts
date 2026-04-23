import prompts from "prompts";
import pc from "picocolors";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_ROOT = join(PACKAGE_ROOT, "templates");

function detectPackageManager(): PackageManager {
  const ua = process.env.npm_config_user_agent ?? "";
  const name = ua.split(" ")[0]?.split("/")[0];
  if (name === "pnpm" || name === "yarn" || name === "bun") return name;
  return "npm";
}

function isValidPackageName(name: string): boolean {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name);
}

function toValidPackageName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/^[._]/, "")
    .replace(/[^a-z0-9-~]/g, "-");
}

function isEmpty(path: string): boolean {
  if (!existsSync(path)) return true;
  const entries = readdirSync(path);
  return entries.length === 0 || (entries.length === 1 && entries[0] === ".git");
}

function clearDir(path: string): void {
  for (const entry of readdirSync(path)) {
    if (entry === ".git") continue;
    rmSync(join(path, entry), { recursive: true, force: true });
  }
}

function substitute(path: string, replacements: Record<string, string>): void {
  let contents = readFileSync(path, "utf-8");
  for (const [key, value] of Object.entries(replacements)) {
    contents = contents.replaceAll(`{{${key}}}`, value);
  }
  writeFileSync(path, contents);
}

function copyTemplate(source: string, target: string): void {
  cpSync(source, target, { recursive: true });
  const gitignoreSrc = join(target, "_gitignore");
  if (existsSync(gitignoreSrc)) {
    renameSync(gitignoreSrc, join(target, ".gitignore"));
  }
}

function onCancel(): never {
  console.log(pc.red("✖") + " Cancelled");
  process.exit(1);
}

type CliArgs = {
  projectName: string | undefined;
  template: "ts" | "js" | undefined;
  yes: boolean;
  noInstall: boolean;
  noGit: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    projectName: undefined,
    template: undefined,
    yes: false,
    noInstall: false,
    noGit: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") args.yes = true;
    else if (a === "--no-install") args.noInstall = true;
    else if (a === "--no-git") args.noGit = true;
    else if (a === "--template" || a === "-t") {
      const v = argv[++i];
      if (v !== "ts" && v !== "js") {
        console.log(pc.red(`✖ --template must be "ts" or "js" (got "${v}")`));
        process.exit(1);
      }
      args.template = v;
    } else if (a === "--javascript") args.template = "js";
    else if (a === "--typescript") args.template = "ts";
    else if (!a.startsWith("-") && !args.projectName) args.projectName = a;
  }
  return args;
}

async function main() {
  console.log();
  console.log(pc.bold(pc.cyan("create-owl")));
  console.log();

  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  if (args.yes && !args.projectName) {
    console.log(pc.red("✖ --yes requires a project name"));
    process.exit(1);
  }

  const initialName = args.projectName ?? "my-owl-app";
  const response = args.yes
    ? {
        projectName: args.projectName,
        overwrite: false,
        typescript: args.template !== "js",
        git: !args.noGit,
        install: !args.noInstall,
      }
    : await prompts(
        [
          {
            type: args.projectName ? null : "text",
            name: "projectName",
            message: "Project name:",
            initial: initialName,
            validate: (name: string) =>
              name.trim().length > 0 ? true : "Project name cannot be empty",
          },
          {
            type: (_, values) => {
              const name = args.projectName ?? values.projectName;
              const target = resolve(cwd, name);
              return !isEmpty(target) ? "confirm" : null;
            },
            name: "overwrite",
            message: (_, values) => {
              const name = args.projectName ?? values.projectName;
              return `Directory "${name}" is not empty. Remove existing files and continue?`;
            },
            initial: false,
          },
          {
            type: (_, values) => {
              if (values.overwrite === false) onCancel();
              return null;
            },
            name: "overwriteCheck",
          },
          {
            type: args.template ? null : "confirm",
            name: "typescript",
            message: "Use TypeScript?",
            initial: true,
          },
          {
            type: args.noGit ? null : "confirm",
            name: "git",
            message: "Initialize a git repository?",
            initial: true,
          },
          {
            type: args.noInstall ? null : "confirm",
            name: "install",
            message: "Install dependencies now?",
            initial: true,
          },
        ],
        { onCancel }
      );

  const projectName = args.projectName ?? response.projectName;
  const typescript: boolean =
    args.template !== undefined ? args.template === "ts" : response.typescript;
  const initGit: boolean = args.noGit ? false : response.git;
  const install: boolean = args.noInstall ? false : response.install;
  const target = resolve(cwd, projectName);

  if (!isEmpty(target) && !response.overwrite) {
    console.log(pc.red(`✖ Directory "${projectName}" is not empty. Aborting.`));
    process.exit(1);
  }

  const packageManager = detectPackageManager();
  const template = typescript ? "ts" : "js";
  const templateDir = join(TEMPLATE_ROOT, template);

  if (!existsSync(templateDir)) {
    console.log(pc.red(`✖ Template "${template}" not found at ${templateDir}`));
    process.exit(1);
  }

  console.log();
  console.log(`Scaffolding project in ${pc.green(relative(cwd, target) || ".")} ...`);

  if (existsSync(target) && !isEmpty(target)) {
    clearDir(target);
  }

  copyTemplate(templateDir, target);

  const pkgName = isValidPackageName(basename(projectName))
    ? basename(projectName)
    : toValidPackageName(basename(projectName));

  const pkgJsonPath = join(target, "package.json");
  substitute(pkgJsonPath, { PROJECT_NAME: pkgName });

  const readmePath = join(target, "README.md");
  if (existsSync(readmePath)) {
    substitute(readmePath, { PROJECT_NAME: pkgName });
  }

  const indexHtmlPath = join(target, "index.html");
  if (existsSync(indexHtmlPath)) {
    substitute(indexHtmlPath, { PROJECT_NAME: pkgName });
  }

  if (install) {
    console.log(`Installing dependencies with ${pc.cyan(packageManager)} ...`);
    const result = spawnSync(packageManager, ["install"], {
      cwd: target,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.status !== 0) {
      console.log(pc.yellow(`⚠ ${packageManager} install exited with code ${result.status}`));
    }
  }

  if (initGit) {
    const git = spawnSync("git", ["init", "-q"], { cwd: target, stdio: "ignore" });
    if (git.status === 0) {
      spawnSync("git", ["add", "."], { cwd: target, stdio: "ignore" });
      spawnSync("git", ["commit", "-q", "-m", "Initial commit from create-owl"], {
        cwd: target,
        stdio: "ignore",
      });
    }
  }

  const relTarget = relative(cwd, target) || ".";
  const runCmd = packageManager === "npm" ? "npm run" : packageManager;
  console.log();
  console.log(pc.green("✓ Done. Next steps:"));
  if (relTarget !== ".") {
    console.log(`    cd ${relTarget}`);
  }
  if (!install) {
    console.log(`    ${packageManager} install`);
  }
  console.log(`    ${runCmd} dev`);
  console.log();
}

main().catch((err) => {
  console.error(pc.red("✖"), err instanceof Error ? err.message : err);
  process.exit(1);
});
