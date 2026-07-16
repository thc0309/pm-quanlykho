import ts from "typescript";
import { describe, expect, it } from "vitest";

const featureSources = import.meta.glob("./**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const rules = [
  ["background", /\bbg-(?:white|gray-(?:50|100))\b/, /\bdark:(?:hover:)?bg-/],
  ["border", /\bborder-gray-(?:200|300)\b/, /\bdark:(?:hover:)?border-/],
  ["text", /\btext-gray-(?:400|500|600|700|800|900)\b/, /\bdark:(?:hover:)?text-/],
  ["status background", /\bbg-(?:error|success|warning)-50\b/, /\bdark:(?:hover:)?bg-/],
  ["status text", /\btext-(?:error|success|warning)-700\b/, /\bdark:(?:hover:)?text-/],
] as const;

describe("feature dark theme classes", () => {
  it("pairs light palette utilities with dark variants", () => {
    const violations: string[] = [];

    for (const [path, contents] of Object.entries(featureSources)) {
      if (path.includes(".test.")) continue;
      const source = ts.createSourceFile(path, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isStringLiteralLike(node) && !node.text.includes("print-sheet")) {
          for (const [label, light, dark] of rules) {
            if (light.test(node.text) && !dark.test(node.text)) {
              const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
              violations.push(`${path.slice(2)}:${line} missing dark ${label}: ${node.text}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }

    expect(violations).toEqual([]);
  });
});
