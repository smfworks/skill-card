interface ActionsProps {
  disabled: boolean;
  busy: "png" | "share" | null;
  onDownloadPng: () => void;
  onCopyShare: () => void;
  onReset: () => void;
}

export function Actions({ disabled, busy, onDownloadPng, onCopyShare, onReset }: ActionsProps) {
  return (
    <div className="actions">
      <button
        type="button"
        className="btn btn-ember"
        disabled={disabled || busy !== null}
        onClick={onDownloadPng}
      >
        {busy === "png" ? "Printing…" : "Download PNG"}
      </button>
      <button
        type="button"
        className="btn"
        disabled={disabled || busy !== null}
        onClick={onCopyShare}
      >
        {busy === "share" ? "Copying…" : "Copy share text"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
