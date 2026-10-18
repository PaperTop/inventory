import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const entries = (path: string) =>
  Object.fromEntries(
    read(path)
      .split("\n")
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );

it("keeps the deployment template limited to Claude and Supabase without credentials", () => {
  expect(entries(".env.example")).toEqual({
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    AI_PROVIDER: "claude",
    ANTHROPIC_API_KEY: "",
    ANTHROPIC_MODEL: "claude-haiku-5-5",
  });
});

it("isolates disposable account placeholders from app settings", () => {
  expect(entries(".env.smoke.example")).toEqual({
    SMOKE_EMAIL: "",
    SMOKE_PASSWORD: "",
    SMOKE_OTHER_EMAIL: "",
    SMOKE_OTHER_PASSWORD: "",
  });
  const scripts = JSON.parse(read("package.json")).scripts;
  for (const name of ["test:supabase", "test:photos"]) {
    expect(scripts[name]).toContain(
      "--env-file=.env.local --env-file=.env.smoke.local",
    );
  }
});

it("keeps real environment files ignored and template files trackable", () => {
  for (const file of [".env.local", ".env.smoke.local"]) {
    expect(
      spawnSync("git", ["check-ignore", "--no-index", "-q", file]).status,
    ).toBe(0);
  }
  for (const file of [".env.example", ".env.smoke.example"]) {
    expect(
      spawnSync("git", ["check-ignore", "--no-index", "-q", file]).status,
    ).toBe(1);
  }
});

it("loads both templates with Node's environment-file parser without running smoke checks", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--env-file=.env.example",
      "--env-file=.env.smoke.example",
      "-e",
      'process.exit(process.env.AI_PROVIDER === "claude" && process.env.SMOKE_PASSWORD === "" ? 0 : 1)',
    ],
    { env: { NODE_ENV: "test" } },
  );
  expect(result.status, result.stderr.toString()).toBe(0);
});
