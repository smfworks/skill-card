import type { SkillCardModel } from "../types.ts";

const SHARE_URL = "https://github.com/smfworks/skill-card";

export function formatStampTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${dd} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()} · ${hh}:${mm} UTC`;
}

export function formatShareText(card: SkillCardModel): string {
  const lines = [
    `✦ ${card.title}`,
    card.name ? `${card.name} · ${card.oneLiner}` : card.oneLiner,
    "",
  ];
  if (card.whenToUse.length) {
    lines.push("When");
    for (const line of card.whenToUse) lines.push(`• ${line}`);
    lines.push("");
  }
  if (card.chips.length) {
    const tools = card.chips.filter((chip) => chip.kind === "tool").map((chip) => chip.label);
    const rest = card.chips.filter((chip) => chip.kind !== "tool").map((chip) => chip.label);
    if (tools.length) lines.push(`Tools: ${tools.join(" · ")}`);
    if (rest.length) lines.push(rest.join(" · "));
    lines.push("");
  }
  if (card.warnings.length) {
    lines.push(`Note: ${card.warnings[0]}`);
    lines.push("");
  }
  lines.push("Skill Card · SMF Works", SHARE_URL);
  return lines.join("\n");
}

export function formatCompactStats(card: SkillCardModel): string {
  const chips = card.chips.length;
  const warns = card.warnings.length;
  const extra = card.moreBeats ? ` · +${card.moreBeats} more` : "";
  return `${card.name ?? "untitled"} · ${card.bullets.length} beats${extra} · ${chips} chips · ${warns} warn`;
}
