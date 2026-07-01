const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

test("comparison benchmark exposes CLI help without optional ORM dependencies", () => {
  const output = execFileSync(process.execPath, ["benchmarks/compare/compare.js", "--help"], {
    encoding: "utf8",
  });

  assert.match(output, /npa,prisma,typeorm/);
  assert.match(output, /--repeat/);
  assert.match(output, /--allow-destructive/);
});
