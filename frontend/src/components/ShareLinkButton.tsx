import { useState } from "react";
import { HiCheckCircle, HiLink } from "react-icons/hi2";
import { createShareLink } from "../api/mappings";

export function ShareLinkButton({
  kind,
  id,
  quiet = false,
}: {
  kind: "mapping" | "plant";
  id: string;
  quiet?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copy() {
    setBusy(true);
    try {
      const { path } = await createShareLink(kind, id);
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      alert("Could not create a share link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={copy}
      disabled={busy}
      className={
        quiet
          ? "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] font-medium text-slate-600 hover:text-brand-navy hover:bg-slate-100 disabled:opacity-50"
          : "px-3 flex items-center justify-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider border-r border-brand-navy/20 text-brand-navy/50 hover:bg-brand-lime hover:text-brand-navy transition-colors disabled:opacity-50"
      }
      title={copied ? "Link copied" : "Copy a read-only link anyone can open"}
    >
      {copied ? <HiCheckCircle className="w-4 h-4" /> : <HiLink className="w-4 h-4" />}
      <span className="hidden sm:inline">{copied ? "Copied" : busy ? "Link…" : "Share"}</span>
    </button>
  );
}
