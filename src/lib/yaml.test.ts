import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asString,
  asStringList,
  nestedMap,
  parseYamlBlock,
  splitFrontmatter,
  unquote,
} from "./yaml.ts";

describe("splitFrontmatter", () => {
  it("returns the whole paste as body when YAML is missing", () => {
    const split = splitFrontmatter("# Hello\n\nNo fence.");
    assert.equal(split.hasFrontmatter, false);
    assert.equal(split.closed, false);
    assert.equal(split.frontmatterRaw, "");
    assert.match(split.body, /^# Hello/);
    assert.equal(split.warnings.length, 0);
  });

  it("splits a closed YAML block from the body", () => {
    const split = splitFrontmatter("---\nname: demo\n---\n\n# Demo\n");
    assert.equal(split.hasFrontmatter, true);
    assert.equal(split.closed, true);
    assert.equal(split.frontmatterRaw, "name: demo");
    assert.equal(split.body.trim(), "# Demo");
  });

  it("does not crash on unclosed frontmatter", () => {
    const split = splitFrontmatter("---\nname: dangling\ndescription: still open\n\n# Body");
    assert.equal(split.hasFrontmatter, false);
    assert.equal(split.body.startsWith("---"), true);
    assert.ok(split.warnings.some((line) => /unclosed/i.test(line)));
  });

  it("strips a leading BOM", () => {
    const split = splitFrontmatter("\uFEFF---\nname: bom\n---\nHi");
    assert.equal(split.hasFrontmatter, true);
    assert.equal(split.frontmatterRaw, "name: bom");
    assert.equal(split.body, "Hi");
  });
});

describe("unquote", () => {
  it("unwraps JSON strings with colons", () => {
    assert.equal(unquote('"Use this when: inbox"'), "Use this when: inbox");
  });

  it("unwraps single quotes", () => {
    assert.equal(unquote("'hello'"), "hello");
  });
});

describe("parseYamlBlock", () => {
  it("reads simple scalars", () => {
    const { fields } = parseYamlBlock("name: inbox-triage\ndescription: Use this when mail piles up.\n");
    assert.equal(fields.name, "inbox-triage");
    assert.equal(fields.description, "Use this when mail piles up.");
  });

  it("reads folded description", () => {
    const { fields } = parseYamlBlock("description: >\n  Use this when unread mail\n  needs sorting.\n");
    assert.equal(fields.description, "Use this when unread mail needs sorting.");
  });

  it("reads literal blocks", () => {
    const { fields } = parseYamlBlock("notes: |\n  line one\n  line two\n");
    assert.equal(fields.notes, "line one\nline two");
  });

  it("reads string lists", () => {
    const { fields } = parseYamlBlock("triggers:\n  - unread overnight\n  - inbox zero\n");
    assert.deepEqual(fields.triggers, ["unread overnight", "inbox zero"]);
  });

  it("reads list-of-maps tools", () => {
    const { fields } = parseYamlBlock(
      "tools:\n  - name: email\n    purpose: draft\n  - name: calendar\n    purpose: holds\n",
    );
    assert.ok(Array.isArray(fields.tools));
    const tools = fields.tools as { name: string; purpose: string }[];
    assert.equal(tools[0]?.name, "email");
    assert.equal(tools[1]?.purpose, "holds");
    assert.deepEqual(asStringList(fields.tools), ["email", "calendar"]);
  });

  it("reads nested hermes tags", () => {
    const { fields } = parseYamlBlock(
      "metadata:\n  hermes:\n    tags:\n      - workflow\n      - email\n",
    );
    const metadata = nestedMap(fields.metadata);
    const hermes = nestedMap(metadata?.hermes);
    assert.deepEqual(hermes?.tags, ["workflow", "email"]);
  });

  it("treats empty flow collections", () => {
    const { fields } = parseYamlBlock("bins: []\nenv: {}\n");
    assert.deepEqual(fields.bins, []);
    assert.deepEqual(fields.env, {});
  });

  it("keeps quoted colons and strips inline comments", () => {
    const { fields } = parseYamlBlock('name: demo # comment\ndescription: "a: b"\n');
    assert.equal(fields.name, "demo");
    assert.equal(fields.description, "a: b");
  });

  it("does not throw on junk lines", () => {
    const parsed = parseYamlBlock("not a key line\nname: ok\n: broken\n");
    assert.equal(asString(parsed.fields.name), "ok");
  });
});
