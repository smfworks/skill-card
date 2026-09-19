import { SAMPLES } from "./data/samples";
import { composeCard, slugify } from "./lib/parse";
import { copyText, downloadBlob, cardToPngBlob, shareTextAndPng } from "./lib/exportImage";
import { formatCompactStats, formatShareText } from "./lib/share";
import type { SkillCardModel } from "./types";
import { Actions } from "./components/Actions";
import { Composer } from "./components/Composer";
import { Header } from "./components/Header";
import { SisterStrip } from "./components/SisterStrip";
import { HandoffBanner } from "./components/HandoffBanner";
import { SkillCard } from "./components/SkillCard";
import { Toast } from "./components/Toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";

export default function App() {
  const [raw, setRaw] = useState("");
  const [card, setCard] = useState<SkillCardModel | null>(null);
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<"png" | "share" | null>(null);
  const [dragging, setDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        setCard(composeCard(raw));
      } catch {
        setCard(null);
        showToast("Could not parse that paste.");
      }
    }, 80);
    return () => window.clearTimeout(handle);
  }, [raw, showToast]);

  const loadSample = useCallback(
    async (id: string) => {
      const sample = SAMPLES.find((item) => item.id === id);
      if (!sample) return;
      try {
        const response = await fetch(sample.file);
        if (!response.ok) throw new Error("missing sample");
        const text = await response.text();
        setRaw(text);
        setSampleId(id);
      } catch {
        showToast("Could not load that sample.");
      }
    },
    [showToast],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sample = params.get("sample");
    if (sample) void loadSample(sample);
    const shot = params.get("shot");
    if (shot === "card" || shot === "og") {
      document.body.classList.add(`shot-${shot}`);
    }
  }, [loadSample]);

  const onFile = useCallback(async (file: File) => {
    const text = await file.text();
    setSampleId(null);
    setRaw(text);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (!file) return;
      const name = file.name.toLowerCase();
      if (
        !name.endsWith(".md") &&
        !name.endsWith(".markdown") &&
        !name.endsWith(".txt") &&
        !name.endsWith(".json")
      ) {
        showToast("Drop a .md or SKILL.md file.");
        return;
      }
      void onFile(file);
    },
    [onFile, showToast],
  );

  const reset = useCallback(() => {
    setRaw("");
    setCard(null);
    setSampleId(null);
    showToast("Cleared.");
  }, [showToast]);

  const withFrame = useCallback(async () => {
    const node = frameRef.current;
    if (!node || !card) throw new Error("Nothing to print yet.");
    node.classList.add("is-exporting");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      return await cardToPngBlob(node);
    } finally {
      node.classList.remove("is-exporting");
    }
  }, [card]);

  const downloadPng = useCallback(async () => {
    if (!card) return;
    setBusy("png");
    try {
      const blob = await withFrame();
      downloadBlob(blob, `skill-card-${slugify(card.name ?? card.title)}.png`);
      showToast("PNG downloaded.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "PNG export failed.");
    } finally {
      setBusy(null);
    }
  }, [card, showToast, withFrame]);

  const copyShare = useCallback(async () => {
    if (!card) return;
    setBusy("share");
    try {
      const text = formatShareText(card);
      const filename = `skill-card-${slugify(card.name ?? card.title)}.png`;
      if (frameRef.current && typeof navigator.share === "function") {
        const blob = await withFrame();
        const mode = await shareTextAndPng(text, blob, filename, card.title);
        showToast(mode === "shared" ? "Shared card." : "Share text copied.");
      } else {
        await copyText(text);
        showToast("Share text copied.");
      }
    } catch {
      showToast("Could not share.");
    } finally {
      setBusy(null);
    }
  }, [card, showToast, withFrame]);

  const live = useMemo(() => {
    if (!card) return "Waiting for a SKILL.md";
    return `${card.title} · ${card.warnings.length ? `${card.warnings.length} notes` : "ready"}`;
  }, [card]);

  return (
    <div className="page">
      <div className="ambient" aria-hidden="true" />
      <Header />
      <SisterStrip current="skill-card" payload={raw} kind="skill-md" />
      <HandoffBanner accept={["skill-md", "plain"]} onPaste={(text) => { setRaw(text); setSampleId(null); }} />
      <main className="layout">
        <Composer
          raw={raw}
          sampleId={sampleId}
          dragging={dragging}
          onRawChange={(value) => {
            setSampleId(null);
            setRaw(value);
          }}
          onSample={(id) => void loadSample(id)}
          onPickFile={() => fileRef.current?.click()}
          onDragState={setDragging}
          onDrop={onDrop}
        />
        <section className="stage" aria-label="Skill card">
          <p className="sr-only" aria-live="polite">
            {live}
          </p>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = "";
            }}
          />
          <div className="stage-scroll">
            <div ref={frameRef} className="export-frame">
              <SkillCard card={card} />
            </div>
          </div>
          {card ? <p className="stage-stats">{formatCompactStats(card)}</p> : null}
          <Actions
            disabled={!card}
            busy={busy}
            onDownloadPng={() => void downloadPng()}
            onCopyShare={() => void copyShare()}
            onReset={reset}
          />
        </section>
      </main>
      <footer className="site-foot">
        <p>Skill Card · SMF Works</p>
        <p>
          Viral kit:{" "}
          <a href="https://paste-to-skill.vercel.app" rel="noreferrer" target="_blank">
            Paste → Skill
          </a>
          {" — create · "}
          <a href="https://github.com/smfworks/skill-lint" rel="noreferrer" target="_blank">
            Skill Lint
          </a>
          {" — grade · "}
          <span>Skill Card — present · </span>
          <a href="https://github.com/smfworks/refuse-card" rel="noreferrer" target="_blank">
            Refuse Card
          </a>
          {" — the gate · "}
          <a href="https://agent-receipt-green.vercel.app" rel="noreferrer" target="_blank">
            Agent Receipt
          </a>
          {" — what ran."}
        </p>
        <p>Intelligence is abundant. Judgment is the product.</p>
        <p>
          MIT · Built by{" "}
          <a href="https://smfworks.com" rel="noreferrer" target="_blank">
            SMF Works
          </a>
          {" · "}
          <a href="https://github.com/smfworks/skill-card" rel="noreferrer" target="_blank">
            GitHub
          </a>
          {" · "}
          <a href="https://x.com/MichaelGannotti" rel="noreferrer" target="_blank">
            @MichaelGannotti
          </a>
        </p>
        <p className="fineprint">
          No secrets, no monetization, no medical or legal advice. A shareable
          card is not an audit, not compliance, and not a substitute for human
          review.
        </p>
      </footer>
      <Toast message={toast} />
    </div>
  );
}
