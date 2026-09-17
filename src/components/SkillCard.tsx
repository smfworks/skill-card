import type { SkillCardModel } from "../types";
import { formatStampTime } from "../lib/share";

interface SkillCardProps {
  card: SkillCardModel | null;
}

function barcodeBars(id: string): number[] {
  const bars: number[] = [];
  for (let i = 0; i < 34; i += 1) {
    const code = id.charCodeAt(i % id.length) + i * 13;
    bars.push(1 + (code % 4));
  }
  return bars;
}

export function SkillCard({ card }: SkillCardProps) {
  const tone = card
    ? card.missingFrontmatter
      ? "is-warn"
      : card.oversized
        ? "is-oversize"
        : "is-ready"
    : "is-empty";

  return (
    <article className={`ticket ${tone}`}>
      <div className="ticket-rail" aria-hidden="true" />
      <header className="ticket-head">
        <div>
          <p className="r-kicker">Skill one-pager</p>
          <h2>Skill Card</h2>
        </div>
        <p className="ticket-seq">{card?.id ?? "SC-————"}</p>
      </header>

      <div className="perf" aria-hidden="true">
        <span />
      </div>

      <div className="ticket-body">
        <section className="r-hero">
          <p className="r-label">Playbook</p>
          <h3>{card?.title ?? "Waiting for a SKILL.md"}</h3>
          {card?.name ? <p className="r-name">{card.name}</p> : null}
          <p className="r-summary">
            {card?.oneLiner ?? "Paste a skill. Print a card. Share the beats — not the file."}
          </p>
        </section>

        {card && card.chips.length > 0 ? (
          <ul className="pill-row" aria-label="Metadata">
            {card.chips.map((chip) => (
              <li key={`${chip.kind}-${chip.label}`} className={`pill is-${chip.kind}`}>
                {chip.label}
              </li>
            ))}
          </ul>
        ) : null}

        <section className="r-block">
          <p className="r-label">When to use</p>
          {card ? (
            card.whenToUse.length ? (
              <ul>
                {card.whenToUse.map((line) => (
                  <li key={line}>
                    <span className="mark-tick">▸</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="r-placeholder">No “when to use” yet — add a section or a description.</p>
            )
          ) : (
            <p className="r-placeholder">Triggers, tools, and the first beats land here.</p>
          )}
        </section>

        <section className="r-block">
          <p className="r-label">First beats</p>
          {card ? (
            card.bullets.length ? (
              <ol className="beat-list">
                {card.bullets.map((line, index) => (
                  <li key={`${index}-${line}`}>
                    <span className="beat-n">{index + 1}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="r-placeholder">No numbered steps yet. The card still prints.</p>
            )
          ) : (
            <p className="r-placeholder">A bounded playbook reads in one glance.</p>
          )}
          {card && card.moreBeats > 0 ? (
            <p className="more-beats">+{card.moreBeats} more in the file · truncated for the card</p>
          ) : null}
        </section>

        {card && card.warnings.length ? (
          <section className="coupon">
            <p className="r-label">Lab note</p>
            {card.warnings.slice(0, 3).map((line) => (
              <p key={line} className="coupon-line">
                {line}
              </p>
            ))}
          </section>
        ) : null}
      </div>

      <div className="perf" aria-hidden="true">
        <span />
      </div>

      <div className="barcode" aria-hidden="true">
        {barcodeBars(card?.id ?? "SC-0000").map((width, index) => (
          <i key={index} style={{ width }} />
        ))}
      </div>

      <footer className="r-foot">
        <p>SMF Works · Skill Card</p>
        <p className="r-link">smfworks.com</p>
        <p className="r-motto">
          {card ? formatStampTime(card.printedAt) : "Lab artifact · not compliance"}
        </p>
        <p className="r-motto">Judgment stays human.</p>
      </footer>
    </article>
  );
}
