"use client";

/** Shared renderer for a normalized media result (image / audio / video / embedding / text). */
export default function ResultView({ result }) {
  if (result.type === "audio") {
    return (
      <div className="flex flex-col gap-2">
        <audio controls src={result.url} className="w-full" />
        <a
          href={result.url}
          download={`speech.${result.format || "mp3"}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline w-fit"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Download {result.format || "mp3"}
        </a>
      </div>
    );
  }

  if (result.type === "images") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {result.images.map((img, i) => (
          <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" className="group relative block">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob/data URLs from generation, not optimizable */}
            <img src={img.url} alt={`result ${i + 1}`} className="rounded-lg w-full object-cover border border-border-subtle" />
            <span className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-md px-1.5 py-0.5 text-[11px]">
              open
            </span>
          </a>
        ))}
      </div>
    );
  }

  if (result.type === "videos") {
    return (
      <div className="flex flex-col gap-2">
        {result.videos.map((v, i) => (
          <video key={i} controls src={v.url} className="rounded-lg w-full border border-border-subtle" />
        ))}
      </div>
    );
  }

  if (result.type === "embedding") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="material-symbols-outlined text-[16px]">data_array</span>
          {result.dims} dimensions
        </div>
        <code className="text-[11px] font-mono text-text-muted break-all bg-surface-2 rounded-lg px-3 py-2">
          [{result.preview?.map((n) => Number(n).toFixed(4)).join(", ")}
          {result.dims > (result.preview?.length || 0) ? ", …" : ""}]
        </code>
      </div>
    );
  }

  return (
    <pre className="text-xs whitespace-pre-wrap break-words font-sans text-text-main max-h-[320px] overflow-y-auto custom-scrollbar">
      {result.text}
    </pre>
  );
}
