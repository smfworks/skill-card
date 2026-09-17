import type { YamlValue } from "./lib/yaml.ts";

export type ChipKind = "tool" | "trigger" | "tag";

export type SampleTone = "playbook" | "stub" | "oversize" | "warn";

export interface SkillChip {
  label: string;
  kind: ChipKind;
}

export interface SkillSection {
  heading: string;
  kind: "steps" | "refuse" | "success" | "when" | "tools" | "other";
  body: string;
}

export interface ParsedSkill {
  raw: string;
  hasFrontmatter: boolean;
  frontmatterRaw: string;
  body: string;
  fields: Record<string, YamlValue>;
  name: string | null;
  description: string | null;
  title: string | null;
  flavor: "hermes" | "openclaw" | "unknown";
  sections: SkillSection[];
  steps: string[];
  whenToUse: string[];
  tools: string[];
  triggers: string[];
  tags: string[];
  refuse: string[];
  charCount: number;
  parseWarnings: string[];
}

export interface SkillCardModel {
  schemaVersion: "skill-card/v1";
  id: string;
  title: string;
  name: string | null;
  oneLiner: string;
  chips: SkillChip[];
  whenToUse: string[];
  bullets: string[];
  moreBeats: number;
  warnings: string[];
  oversized: boolean;
  missingFrontmatter: boolean;
  flavor: "hermes" | "openclaw" | "unknown";
  charCount: number;
  printedAt: string;
}

export interface SampleMeta {
  id: string;
  file: string;
  label: string;
  blurb: string;
  tone: SampleTone;
}

export const SCHEMA_VERSION = "skill-card/v1" as const;

export const OVERSIZE_CHARS = 3500;
export const OVERSIZE_STEPS = 8;
export const CARD_WHEN_LIMIT = 4;
export const CARD_BULLET_LIMIT = 5;
export const CARD_CHIP_LIMIT = 8;
