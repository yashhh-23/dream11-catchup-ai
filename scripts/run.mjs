import { spawn } from "node:child_process";

const [majorStr, minorStr] = process.versions.node.split(".");
const major = parseInt(majorStr, 10);
const minor = parseInt(minorStr, 10);

const hasNativeStripTypes = major > 22 || (major === 22 && minor >= 6);

const target = process.argv[2] || "test";
const extraArgs = process.argv.slice(3);

let scriptPath = "tests/unit.test.mjs";
let isTest = false;

if (target === "eval" || target.includes("eval")) {
  scriptPath = "scripts/evalRecaps.mjs";
} else if (target === "test" || target.includes("test")) {
  scriptPath = "tests/unit.test.mjs";
  isTest = true;
} else {
  scriptPath = target;
  if (target.includes("test")) {
    isTest = true;
  }
}

let command = process.execPath;
let args = [];
let useShell = false;

if (hasNativeStripTypes) {
  args = isTest
    ? ["--test", "--experimental-strip-types", scriptPath, ...extraArgs]
    : ["--experimental-strip-types", scriptPath, ...extraArgs];
} else {
  // Seamless fallback for Node 18 & Node 20 runtimes (standard enterprise CI)
  command = process.platform === "win32" ? "npx.cmd" : "npx";
  args = isTest
    ? ["--yes", "tsx", "--test", scriptPath, ...extraArgs]
    : ["--yes", "tsx", scriptPath, ...extraArgs];
  useShell = process.platform === "win32";
}

const child = spawn(command, args, { stdio: "inherit", shell: useShell });
child.on("exit", (code) => {
  process.exit(code ?? 0);
});
