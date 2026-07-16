import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, it } from "vitest";

it("uses Roboto as the global application font", () => {
  const css = readFileSync(resolve("src/index.css"), "utf8");

  expect(css).toContain("family=Roboto");
  expect(css).toContain("--font-roboto: Roboto, sans-serif");
  expect(css).toContain("font-roboto");
  expect(css).not.toMatch(/Outf[i]t/);
});
