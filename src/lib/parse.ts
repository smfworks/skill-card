import type { ParsedSkill, SkillCardModel, SkillChip, SkillSection } from "../types.ts";
import {
  CARD_BULLET_LIMIT,
  CARD_CHIP_LIMIT,
  CARD_WHEN_LIMIT,
  OVERSIZE_CHARS,
  OVERSIZE_STEPS,
  SCHEMA_VERSION,
} from "../types.ts";
import {
  asString,
  asStringList,
  nestedMap,
  parseYamlBlock,
  pickField,
  splitFrontmatter,
  type YamlMap,
} from "./yaml.ts";

const MAX_PARSE = 80_000;

function headingKind(heading: string): SkillSection["kind"] {
  const stripped = heading
    .replace(/^#{1,6}\s+/, "")
    .replace(/[:\-–]\s*$/, "")
    .trim()
    .toLowerCase();
  if (/^(steps?|checklist|procedure|playbook|how to)\b/.test(stripped)) return "steps";
  if (/^(refuse|never|never do|never-do|pitfalls|out of scope|don'?t|do not)\b/.test(stripped)) {
    return "refuse";
  }
  if (/^(success|success criteria|verification|done when|done|acceptance|criteria)\b/.test(stripped)) {
    return "success";
  }
  if (/^(when to use|use when|when|goal \/ when to use|goal\/when to use)\b/.test(stripped)) {
    return "when";
  }
  if (/^(inputs?|tools?|inputs? \/ tools?|inputs?\/tools?)\b/.test(stripped)) return "tools";
  return "other";
}

function firstHeading(body: string): string | null {
  const match = body.match(/^#{1,6}\s+(\S[^\n]*)$/m);
  return match ? match[1].trim() : null;
}

function firstParagraph(body: string): string | null {
  const parts = body.trim().split(/\n\s*\n/);
  for (const part of parts) {
    if (/^#{1,6}\s+\S[^\n]*$/.test(part.trim())) continue;
    const text = part
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*(?:\d+[.)]\s+|[-*•–—]\s+)/gm, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length >= 8) return text;
  }
  return null;
}

function collectListItems(block: string, stripDashTail = false): string[] {
  const items: string[] = [];
  for (const line of block.split("\n")) {
    const match = line.match(/^\s*(?:\d+[.)]\s+|[-*•–—]\s+|\[[ xX]\]\s+)(.+)$/);
    if (match) {
      let text = match[1].replace(/\*\*([^*]+)\*\*/g, "$1");
      if (stripDashTail) text = text.replace(/\s+[—–-]\s+.*$/, "");
      text = text.replace(/\s+/g, " ").trim();
      if (text && !/^input:/i.test(text)) items.push(text);
    }
  }
  return items;
}

function collectNumberedAnywhere(body: string): string[] {
  const items: string[] = [];
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (match) {
      const text = match[1].replace(/\s+/g, " ").trim();
      if (text.length >= 8) items.push(text);
    }
  }
  return items;
}

function parseSections(body: string): SkillSection[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const sections: SkillSection[] = [];
  let current: SkillSection = { heading: "", kind: "other", body: "" };
  const flush = () => {
    const text = current.body.trim();
    if (current.heading || text) {
      sections.push({ ...current, body: text });
    }
  };
  for (const line of lines) {
    if (/^#{1,6}\s+\S/.test(line)) {
      flush();
      current = { heading: line.trim(), kind: headingKind(line), body: "" };
      continue;
    }
    current.body += (current.body ? "\n" : "") + line;
  }
  flush();
  return sections;
}

function detectFlavor(fields: YamlMap): ParsedSkill["flavor"] {
  const metadata = nestedMap(fields.metadata);
  if (metadata) {
    if (nestedMap(metadata.openclaw) || nestedMap(metadata.OpenClaw)) return "openclaw";
    if (nestedMap(metadata.hermes) || nestedMap(metadata.Hermes)) return "hermes";
  }
  if (pickField(fields, "compatibility", "allowed-tools")) return "unknown";
  return "unknown";
}

function hermesTags(fields: YamlMap): string[] {
  const metadata = nestedMap(fields.metadata);
  const hermes = nestedMap(metadata?.hermes) ?? nestedMap(metadata?.Hermes);
  return asStringList(hermes?.tags);
}

function openclawBins(fields: YamlMap): string[] {
  const metadata = nestedMap(fields.metadata);
  const openclaw = nestedMap(metadata?.openclaw) ?? nestedMap(metadata?.OpenClaw);
  const requires = nestedMap(openclaw?.requires);
  return asStringList(requires?.bins);
}

export function parseSkill(markdown: string): ParsedSkill {
  const raw = markdown.slice(0, MAX_PARSE);
  const split = splitFrontmatter(raw);
  const yaml = split.hasFrontmatter ? parseYamlBlock(split.frontmatterRaw) : { fields: {}, warnings: [] };
  const fields = yaml.fields;
  const name = asString(fields.name);
  const description = asString(fields.description);
  const sections = parseSections(split.body);
  const stepSection = sections.find((section) => section.kind === "steps");
  const whenSection = sections.find((section) => section.kind === "when");
  const toolSection = sections.find((section) => section.kind === "tools");
  const refuseSection = sections.find((section) => section.kind === "refuse");

  const stepsFromSection = stepSection ? collectListItems(stepSection.body) : [];
  const numbered = collectNumberedAnywhere(split.body);
  const steps = stepsFromSection.length >= numbered.length ? stepsFromSection : numbered;

  const whenFromSection = whenSection ? collectListItems(whenSection.body) : [];
  const whenFromFields = asStringList(
    pickField(fields, "when_to_use", "whenToUse", "when", "triggers"),
  );
  const whenToUse = whenFromSection.length ? whenFromSection : whenFromFields;

  const toolsFromSection = toolSection ? collectListItems(toolSection.body, true) : [];
  const toolsFromFields = asStringList(pickField(fields, "tools", "allowed-tools"));
  const bins = openclawBins(fields);
  const tools = unique([...toolsFromFields, ...bins, ...toolsFromSection]);

  const triggers = unique([
    ...asStringList(pickField(fields, "triggers")),
    ...(whenFromSection.length ? [] : whenFromFields),
  ]);

  const tags = unique([
    ...asStringList(pickField(fields, "tags")),
    ...hermesTags(fields),
  ]);

  const refuse = refuseSection
    ? collectListItems(refuseSection.body).length
      ? collectListItems(refuseSection.body)
      : refuseSection.body
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length >= 8)
    : [];

  return {
    raw,
    hasFrontmatter: split.hasFrontmatter,
    frontmatterRaw: split.frontmatterRaw,
    body: split.body,
    fields,
    name,
    description,
    title: firstHeading(split.body),
    flavor: detectFlavor(fields),
    sections,
    steps,
    whenToUse,
    tools,
    triggers,
    tags,
    refuse,
    charCount: raw.trim().length,
    parseWarnings: [...split.warnings, ...yaml.warnings],
  };
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const normalized = item.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

export function titleFromName(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function slugify(input: string): string {
  const stop = new Set(["a", "an", "the", "and", "or", "of"]);
  const words = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !stop.has(word));
  const fallback = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  let slug = (words.length ? words.join("-") : fallback)
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-$/g, "");
  if (!slug || !/^[a-z]/.test(slug)) slug = `skill-${slug || "untitled"}`.slice(0, 64);
  if (slug.endsWith("-")) slug = slug.slice(0, -1);
  return slug || "untitled-skill";
}

export function cardId(source: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `SC-${(hash >>> 0).toString(16).toUpperCase().padStart(4, "0").slice(-4)}`;
}

function clip(text: string, max: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

function buildChips(skill: ParsedSkill): SkillChip[] {
  const chips: SkillChip[] = [];
  const seen = new Set<string>();
  const push = (label: string, kind: SkillChip["kind"]) => {
    const trimmed = clip(label, 28);
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    chips.push({ label: trimmed, kind });
  };
  for (const tool of skill.tools) push(tool, "tool");
  for (const trigger of skill.triggers) push(trigger, "trigger");
  for (const tag of skill.tags) push(tag, "tag");
  if (skill.flavor === "hermes") push("hermes", "tag");
  if (skill.flavor === "openclaw") push("openclaw", "tag");
  return chips.slice(0, CARD_CHIP_LIMIT);
}

function whenLines(skill: ParsedSkill): string[] {
  if (skill.whenToUse.length) return skill.whenToUse;
  const description = skill.description ?? "";
  const match = description.match(/^use this when\s+(.+)/i);
  if (match) return [match[1].replace(/\.$/, "")];
  return [];
}

export function composeCard(markdown: string, printedAt = new Date()): SkillCardModel | null {
  const trimmed = markdown.trim();
  if (!trimmed) return null;

  let source = trimmed;
  if (trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && "markdown" in parsed) {
        const nested = (parsed as { markdown: unknown }).markdown;
        if (typeof nested === "string" && nested.trim()) source = nested;
      }
    } catch {
      // Fall through — treat as markdown.
    }
  }

  const skill = parseSkill(source);
  const warnings = [...skill.parseWarnings];
  const missingFrontmatter = !skill.hasFrontmatter;
  if (missingFrontmatter) {
    warnings.push("No YAML frontmatter — presenting from the body.");
  }
  if (!skill.name) warnings.push("Missing name — using the first heading.");
  if (!skill.description) warnings.push("Missing description — using the opening paragraph.");

  const oversized =
    skill.charCount > OVERSIZE_CHARS ||
    skill.steps.length > OVERSIZE_STEPS ||
    skill.sections.length > 8;
  if (oversized) warnings.push("Oversized skill — card shows the first beats only.");

  const title =
    skill.title ||
    (skill.name ? titleFromName(skill.name) : null) ||
    "Untitled skill";
  const oneLiner =
    skill.description ||
    firstParagraph(skill.body) ||
    "A skill without a one-liner. Add a description in the frontmatter.";

  const whenToUse = whenLines(skill).slice(0, CARD_WHEN_LIMIT);
  const bullets = (skill.steps.length ? skill.steps : skill.refuse).slice(0, CARD_BULLET_LIMIT);
  const moreBeats = Math.max(0, (skill.steps.length || skill.refuse.length) - bullets.length);

  const uniqueWarnings = unique(warnings);

  return {
    schemaVersion: SCHEMA_VERSION,
    id: cardId(source),
    title: clip(title, 72),
    name: skill.name,
    oneLiner: clip(oneLiner, 180),
    chips: buildChips(skill),
    whenToUse: whenToUse.map((line) => clip(line, 96)),
    bullets: bullets.map((line) => clip(line, 110)),
    moreBeats,
    warnings: uniqueWarnings,
    oversized,
    missingFrontmatter,
    flavor: skill.flavor,
    charCount: skill.charCount,
    printedAt: printedAt.toISOString(),
  };
}
