import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { cardId, composeCard, parseSkill, slugify, titleFromName } from "./parse.ts";
import { splitFrontmatter } from "./yaml.ts";

const sampleDir = join(fileURLToPath(new URL(".", import.meta.url)), "../../public/samples");

function loadSample(id: string): string {
  return readFileSync(join(sampleDir, `${id}.md`), "utf8");
}

describe("slugify / titleFromName", () => {
  it("emits kebab-case without stopwords", () => {
    assert.equal(slugify("Triage the Inbox"), "triage-inbox");
  });

  it("stays within 64 characters", () => {
    assert.ok(slugify("x".repeat(80)).length <= 64);
  });

  it("title-cases a kebab name", () => {
    assert.equal(titleFromName("inbox-triage"), "Inbox Triage");
  });
});

describe("sample cards", () => {
  it("inbox-triage is a solid playbook card", () => {
    const card = composeCard(loadSample("inbox-triage"), new Date("2026-09-17T01:00:00Z"));
    assert.ok(card);
    assert.equal(card.schemaVersion, "skill-card/v1");
    assert.equal(card.name, "inbox-triage");
    assert.equal(card.title, "Inbox triage");
    assert.match(card.oneLiner, /unread mail/i);
    assert.equal(card.missingFrontmatter, false);
    assert.equal(card.oversized, false);
    assert.ok(card.whenToUse.length >= 2);
    assert.ok(card.bullets.length >= 4);
    assert.ok(card.bullets.some((line) => /do not send/i.test(line)));
    assert.ok(card.chips.some((chip) => chip.kind === "tool" && /email/i.test(chip.label)));
    assert.ok(card.chips.some((chip) => chip.kind === "tag" && /workflow/i.test(chip.label)));
    assert.equal(card.warnings.length, 0);
    assert.equal(card.id.startsWith("SC-"), true);
  });

  it("standup-notes is a named stub that still prints", () => {
    const card = composeCard(loadSample("standup-notes"));
    assert.ok(card);
    assert.equal(card.name, "standup-notes");
    assert.equal(card.missingFrontmatter, false);
    assert.ok(card.bullets.length >= 1);
    assert.ok(card.oneLiner.toLowerCase().includes("standup"));
  });

  it("release-runbook is oversized and truncated", () => {
    const card = composeCard(loadSample("release-runbook"));
    assert.ok(card);
    assert.equal(card.oversized, true);
    assert.ok(card.moreBeats > 0);
    assert.ok(card.bullets.length <= 5);
    assert.ok(card.whenToUse.length <= 4);
    assert.ok(card.warnings.some((line) => /oversized/i.test(line)));
    assert.ok(card.chips.some((chip) => /git|gh|docker/i.test(chip.label)));
  });

  it("lab-letter missing frontmatter still renders with warnings", () => {
    const markdown = loadSample("lab-letter");
    assert.equal(splitFrontmatter(markdown).hasFrontmatter, false);
    const card = composeCard(markdown);
    assert.ok(card);
    assert.equal(card.missingFrontmatter, true);
    assert.equal(card.title, "Lab letter");
    assert.match(card.oneLiner, /friday note/i);
    assert.equal(card.name, null);
    assert.ok(card.bullets.length >= 3);
    assert.ok(card.warnings.some((line) => /frontmatter/i.test(line)));
    assert.ok(card.warnings.some((line) => /missing name/i.test(line)));
  });
});

describe("composeCard", () => {
  it("returns null for empty paste", () => {
    assert.equal(composeCard("   "), null);
  });

  it("does not throw on unclosed frontmatter", () => {
    const card = composeCard("---\nname: dangling\n# still the body\n\n1. Keep going.");
    assert.ok(card);
    assert.equal(card.missingFrontmatter, true);
    assert.ok(card.warnings.some((line) => /unclosed|frontmatter/i.test(line)));
  });

  it("accepts a JSON wrapper from sister tools", () => {
    const card = composeCard(
      JSON.stringify({
        markdown: "---\nname: wrapped\ndescription: Use this when testing JSON.\n---\n\n# Wrapped\n\n1. Parse the envelope.\n",
      }),
    );
    assert.ok(card);
    assert.equal(card.name, "wrapped");
    assert.equal(card.title, "Wrapped");
  });

  it("is deterministic for the same paste and clock", () => {
    const paste = loadSample("inbox-triage");
    const at = new Date("2026-09-17T01:00:00Z");
    assert.deepEqual(composeCard(paste, at), composeCard(paste, at));
    assert.equal(cardId(paste.trim()), composeCard(paste, at)?.id);
  });

  it("falls back to the opening paragraph when description is missing", () => {
    const card = composeCard("---\nname: quiet\n---\n\n# Quiet\n\nA body one-liner that is long enough.\n");
    assert.ok(card);
    assert.match(card.oneLiner, /body one-liner/i);
    assert.ok(card.warnings.some((line) => /missing description/i.test(line)));
  });
});

describe("parseSkill", () => {
  it("pulls OpenClaw bins onto the tool list", () => {
    const skill = parseSkill(loadSample("release-runbook"));
    assert.equal(skill.flavor, "openclaw");
    assert.ok(skill.tools.includes("docker"));
    assert.ok(skill.triggers.includes("tagged release"));
  });
});
