"use client";

import { useEffect, useRef, useState } from "react";

let counter = 0;

/** Renders a Mermaid diagram from source. Falls back to the raw code on error. */
export default function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose", fontFamily: "Inter, sans-serif" });
        const id = `mmd-${counter++}`;
        const { svg } = await mermaid.render(id, code.trim());
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (err) {
    return (
      <pre className="overflow-x-auto rounded-lg bg-[#f8fafc] p-3 text-xs text-gray-600">{code}</pre>
    );
  }
  return <div ref={ref} className="flex justify-center [&_svg]:max-w-full [&_svg]:h-auto" />;
}
