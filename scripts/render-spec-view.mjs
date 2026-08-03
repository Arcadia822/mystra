#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(repoRoot, ".specify/templates/spec-view-template.html");

function usage() {
  console.error(`Usage:
scripts/render-spec-view.mjs --feature <spec-directory-name> [--out <html-path>]`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      throw new Error(`Unexpected argument: ${current}`);
    }
    const key = current.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replaceAll("</", "<\\/");
}

async function readOptional(relativePath) {
  try {
    return await readFile(path.join(repoRoot, relativePath), "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function buildMissingDoc(label, relativePath) {
  return `# ${label}\n\n_${relativePath} is not present for this spec yet._`;
}

function replaceToken(template, token, value) {
  return template.replaceAll(`{{${token}}}`, value);
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  usage();
}

if (!args.feature) {
  usage();
}

const feature = args.feature;
const specDir = `specs/${feature}`;
const outputPath = path.resolve(repoRoot, args.out ?? path.join(specDir, "index.html"));
const outputDir = path.dirname(outputPath);
const relativeFromOutput = (target) => path.relative(outputDir, path.join(repoRoot, target)).replaceAll(path.sep, "/");

async function versionedRelativeFromOutput(target) {
  const href = relativeFromOutput(target);
  try {
    const info = await stat(path.join(repoRoot, target));
    return `${href}?v=${Math.trunc(info.mtimeMs)}`;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return href;
    }
    throw error;
  }
}

const files = {
  spec: await readOptional(`${specDir}/spec.md`),
  features: await readOptional(`${specDir}/features.md`),
  checklists: await readOptional(`${specDir}/checklists.md`),
  prototype: await readOptional(`${specDir}/prototype.md`),
  plan: await readOptional(`${specDir}/plan.md`),
  tasks: await readOptional(`${specDir}/tasks.md`),
};

const prototypePath = `${specDir}/mockups/index.html`;
const prototypeHref = await versionedRelativeFromOutput(prototypePath);
const title = feature;
const specBody = files.spec || buildMissingDoc("Spec Document", `${specDir}/spec.md`);
const features = files.features || buildMissingDoc("Features", `${specDir}/features.md`);
const checklists = files.checklists || buildMissingDoc("Checklists", `${specDir}/checklists.md`);
const prototype =
  files.prototype ||
  `# Prototype\n\n_${specDir}/prototype.md is not present for this spec yet._\n\n[Open current standalone prototype](${prototypeHref})`;
const plan = files.plan || buildMissingDoc("Plan", `${specDir}/plan.md`);
const tasks = files.tasks || buildMissingDoc("Tasks", `${specDir}/tasks.md`);

const payload = {
  feature,
  title,
  prototypeHref,
  generatedAt: new Date().toISOString(),
  tabs: [
    {
      id: "spec",
      label: "SPEC",
      eyebrow: "Specification",
      markdown: specBody,
    },
    {
      id: "features",
      label: "FEATURES",
      eyebrow: "Features",
      markdown: features,
    },
    {
      id: "checklists",
      label: "CHECKLISTS",
      eyebrow: "Checklists",
      markdown: checklists,
    },
    {
      id: "prototype",
      label: "PROTOTYPE",
      eyebrow: "Prototype",
      markdown: prototype,
      action: {
        label: "Open Prototype",
        href: prototypeHref,
      },
    },
    {
      id: "plan",
      label: "PLAN",
      eyebrow: "Plan",
      markdown: plan,
    },
    {
      id: "tasks",
      label: "TASKS",
      eyebrow: "Tasks",
      markdown: tasks,
    },
  ],
};

let template = await readFile(templatePath, "utf8");
template = replaceToken(template, "PAGE_TITLE", escapeHtml(title));
template = replaceToken(template, "SPEC_DATA", escapeScriptJson(payload));

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, template);
console.log(path.relative(repoRoot, outputPath));
