import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tasksDir = path.join(root, "tasks");
const memoryDir = path.join(tasksDir, "memory");
const [todo, plan] = await Promise.all([
  readFile(path.join(tasksDir, "todo.md"), "utf8"),
  readFile(path.join(tasksDir, "plan.md"), "utf8"),
]);

const tasks = [...todo.matchAll(/^- \[([ x])\] (.+)$/gm)].map((match) => ({
  done: match[1] === "x",
  title: match[2],
}));
const pending = tasks.filter((task) => !task.done);
const completed = tasks.filter((task) => task.done);

const shortTerm = `# Short-term Memory

> Generated from \`tasks/todo.md\`. Do not edit by hand.

- Active: ${pending[0]?.title ?? "No pending task"}
- Progress: ${completed.length}/${tasks.length} checklist items complete

## Next queue

${pending.slice(0, 5).map((task) => `- ${task.title}`).join("\n") || "- Empty"}

## Recently completed

${completed.slice(-5).reverse().map((task) => `- ${task.title}`).join("\n") || "- Empty"}
`;

let heading = "Project";
const history = [];
for (const line of plan.split(/\r?\n/)) {
  if (/^### (T\d+|Checkpoint)/.test(line)) heading = line.replace(/^### /, "");
  if (/^\*\*(Evidence|Review decision)/.test(line)) {
    history.push(`- ${heading}: ${line.replace(/^\*\*[^*]+:\*\*\s*/, "")}`);
  }
}

const longTerm = `# Long-term Memory

> Generated from verified evidence in \`tasks/plan.md\`. Do not edit by hand.

${history.join("\n") || "- No verified task evidence yet."}
`;

const outputs = [
  [path.join(memoryDir, "short-term.md"), shortTerm],
  [path.join(memoryDir, "long-term.md"), longTerm],
];

if (process.argv.includes("--check")) {
  for (const [file, expected] of outputs) {
    const actual = await readFile(file, "utf8").catch(() => "");
    if (actual !== expected) throw new Error(`${path.relative(root, file)} is stale; run npm run memory:update`);
  }
} else {
  await mkdir(memoryDir, { recursive: true });
  await Promise.all(outputs.map(([file, content]) => writeFile(file, content)));
}
