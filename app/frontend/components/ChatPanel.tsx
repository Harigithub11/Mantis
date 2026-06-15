"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, createSession, listResources, manualPageUrl, streamChat, submitFeedback } from "@/lib/api";
import type { Chunk, Citation, Resource } from "@/lib/types";
import Mermaid from "./Mermaid";

// Minimal Web Speech API typings.
type SpeechRecognitionEventLike = { results: { [i: number]: { [j: number]: { transcript: string } } } };
interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onresult: (ev: SpeechRecognitionEventLike) => void; onend: () => void; onerror: () => void; start: () => void;
}

type Msg = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  imageUrl?: string;
  mossMs?: number | null;
  chunks?: Chunk[];
  observation?: string | null;
  suggestions?: string[];
  feedback?: "good" | "bad" | null;
  streaming?: boolean;
};

type Source = { key: string; kind: "pdf" | "link"; title: string; pages: string[]; snippet: string; full: string; url?: string };

function mossLabel(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return null;
  return ms <= 0 ? "<1 ms" : `${ms} ms`;
}
function domainOf(url: string) {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}
/** Split a trailing ```mermaid block out of the prose. */
function splitMermaid(text: string): { prose: string; mermaid: string | null } {
  const m = text.match(/```mermaid\s*([\s\S]*?)```/i);
  if (!m) return { prose: text, mermaid: null };
  return { prose: text.replace(m[0], "").trim(), mermaid: m[1].trim() };
}

// Action-row icons (slate, icon-only — matches the Figma chat design).
const I = {
  copy: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  up: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>,
  down: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" /></svg>,
  sources: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
};

export default function ChatPanel({ productId }: { productId: number }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [linkResources, setLinkResources] = useState<Resource[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const sessionRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const speakRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSttSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    setTtsSupported("speechSynthesis" in window);
    listResources(productId).then((rs) => setLinkResources(rs.filter((r) => r.type === "link" && r.url))).catch(() => {});
  }, [productId]);

  useEffect(() => {
    speakRef.current = speak;
    if (!speak && typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, [speak]);

  const sources = useMemo(() => {
    const map = new Map<string, Source>();
    for (const m of messages) {
      if (m.role !== "assistant" || !m.citations) continue;
      for (const c of m.citations) {
        const ch = m.chunks?.find((x) => x.source === c.source && String(x.page) === String(c.page));
        const text = ch?.text || c.quote || "";
        const key = `pdf#${c.source}`;
        const ex = map.get(key);
        if (ex) {
          if (c.page && !ex.pages.includes(String(c.page))) ex.pages.push(String(c.page));
          if (text && !ex.full.includes(text)) ex.full += (ex.full ? "\n\n" : "") + text;
          if (!ex.snippet) ex.snippet = text.slice(0, 150);
        } else {
          map.set(key, { key, kind: "pdf", title: c.source, pages: [String(c.page)], snippet: text.slice(0, 150), full: text });
        }
      }
    }
    for (const r of linkResources) {
      map.set(`link#${r.id}`, { key: `link#${r.id}`, kind: "link", title: r.title, pages: [], snippet: r.url || "", full: r.url || "", url: r.url || undefined });
    }
    return Array.from(map.values());
  }, [messages, linkResources]);

  async function copy(text: string, tag: string) {
    try { await navigator.clipboard.writeText(text); setCopied(tag); setTimeout(() => setCopied(null), 1500); } catch {}
  }
  function speakText(text: string) {
    if (!speakRef.current || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
  function startListening() {
    if (listening) return;
    const w = window as unknown as Record<string, unknown>;
    const SR = (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (ev) => { const t = ev.results[0][0].transcript; setInput(t); send(t); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true); rec.start();
  }
  function patchLastAssistant(patch: Partial<Msg>) {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) if (next[i].role === "assistant") { next[i] = { ...next[i], ...patch }; break; }
      return next;
    });
  }
  async function rate(idx: number, mid: number | undefined, rating: "good" | "bad") {
    if (!mid) return;
    setMessages((prev) => { const n = [...prev]; n[idx] = { ...n[idx], feedback: n[idx].feedback === rating ? null : rating }; return n; });
    const next = messages[idx]?.feedback === rating ? null : rating;
    submitFeedback(mid, next).catch(() => {});
  }

  async function send(textOverride?: string) {
    const question = (textOverride ?? input).trim();
    if ((!question && !image) || busy) return;
    setBusy(true);
    const imageUrl = image ? URL.createObjectURL(image) : undefined;
    setMessages((prev) => [...prev, { role: "user", content: question, imageUrl }, { role: "assistant", content: "", streaming: true }]);
    const sentImage = image;
    setInput(""); setImage(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (sessionRef.current === null) sessionRef.current = (await createSession(productId)).session_id;
      await streamChat(productId, sessionRef.current, question, sentImage, (e) => {
        if (e.type === "meta") {
          patchLastAssistant({ mossMs: e.moss_time_ms, chunks: e.chunks, observation: e.observation });
        } else if (e.type === "delta") {
          setMessages((prev) => { const n = [...prev]; const last = n[n.length - 1]; if (last?.role === "assistant") n[n.length - 1] = { ...last, content: last.content + e.text }; return n; });
        } else if (e.type === "final") {
          patchLastAssistant({ id: e.message_id, content: e.reply, citations: e.citations, suggestions: e.suggestions || [] });
          speakText(e.reply);
        } else if (e.type === "done") {
          patchLastAssistant({ streaming: false });
        }
      }, controller.signal);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        patchLastAssistant({ streaming: false }); // keep the partial reply
      } else {
        patchLastAssistant({ content: "Sorry — I couldn't reach the assistant. Please try again.", streaming: false });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      if (pendingRef.current) { const t = pendingRef.current; pendingRef.current = null; setTimeout(() => send(t), 0); }
    }
  }

  // Stop the current generation (keep the partial reply). If the user has typed a new
  // message, queue it to send right after — empty input just stops.
  function stop() {
    const pending = input.trim();
    if (pending) { pendingRef.current = pending; setInput(""); }
    abortRef.current?.abort();
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const quickReplies = !busy && lastAssistant && !lastAssistant.streaming ? lastAssistant.suggestions ?? [] : [];

  return (
    <div className="flex h-[72vh] gap-4">
      <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-gray-200" style={{ background: "linear-gradient(180deg,#ffffff 0%,#ffffff 70%,#fff6ec 100%)" }}>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.length === 0 && (
            <p className="mt-10 text-center text-sm text-gray-400">Describe the problem — e.g. &ldquo;the LED keeps blinking red&rdquo;. You can speak it 🎤 or attach a photo 📎.</p>
          )}

          {messages.map((m, i) => {
            if (m.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl bg-[#f0f5f9] px-4 py-2 text-sm text-[#334155]">
                    {m.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imageUrl} alt="attachment" className="mb-2 max-h-40 rounded-lg" />
                    )}
                    {m.content}
                  </div>
                </div>
              );
            }
            const { prose, mermaid } = splitMermaid(m.content);
            const cite = m.citations?.[0];
            const figureUrl = cite ? manualPageUrl(productId, cite.source, cite.page) : null;
            return (
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F98613] text-sm font-extrabold italic text-white">M</div>
                <div className="min-w-0 flex-1">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-[#0a1628]">
                    {prose || (m.streaming ? <span className="text-gray-400">thinking…</span> : "")}
                  </div>
                  {m.observation && <div className="mt-1 text-xs text-gray-500">👁 What I see: {m.observation}</div>}

                  {/* Action row (after the answer is complete) */}
                  {!m.streaming && m.content && (
                    <div className="mt-2 flex items-center gap-3 text-[#64748B]">
                      <button onClick={() => copy(m.content, `c${i}`)} title="Copy response" className="hover:text-[#0a1628]">{copied === `c${i}` ? <span className="text-xs text-emerald-600">Copied ✓</span> : I.copy}</button>
                      <button onClick={() => rate(i, m.id, "good")} title="Good response" className={m.feedback === "good" ? "text-emerald-600" : "hover:text-[#0a1628]"}>{I.up}</button>
                      <button onClick={() => rate(i, m.id, "bad")} title="Bad response" className={m.feedback === "bad" ? "text-red-500" : "hover:text-[#0a1628]"}>{I.down}</button>
                      {m.citations && m.citations.length > 0 && <button onClick={() => setPanelOpen(true)} title="Sources" className="hover:text-[#0a1628]">{I.sources}</button>}
                    </div>
                  )}

                  {/* Diagrams under the answer: mermaid flowchart + cited manual page */}
                  {!m.streaming && mermaid && (
                    <div className="mt-3 rounded-[10px] border border-[#e5e7eb] bg-white p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748b]">Diagnostic flow</p>
                      <Mermaid code={mermaid} />
                    </div>
                  )}
                  {!m.streaming && figureUrl && (
                    <figure className="mt-3 w-fit overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={figureUrl} alt={`Manual page ${cite!.page}`} className="max-h-72 w-auto object-contain" onError={(e) => { (e.currentTarget.closest("figure") as HTMLElement).style.display = "none"; }} />
                      <figcaption className="border-t border-[#e5e7eb] px-3 py-1.5 text-xs text-[#64748b]">From the manual · {cite!.source} · p.{cite!.page}</figcaption>
                    </figure>
                  )}

                  {mossLabel(m.mossMs) && (
                    <button onClick={() => setPanelOpen(true)} className="mt-2 inline-flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">⚡ Powered by MOSS · {mossLabel(m.mossMs)}</span>
                      {m.chunks && m.chunks.length > 0 && <span className="text-gray-400">Sources ({m.chunks.length})</span>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Dynamic quick-replies — only on follow-up turns, tailored to the question */}
        {quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5">
            {quickReplies.map((q) => (
              <button key={q} onClick={() => send(q)} className="rounded-[10px] border border-[#f98613] bg-[rgba(255,163,60,0.07)] px-4 py-1.5 text-sm text-[#0a1628] hover:bg-[rgba(255,163,60,0.15)]">{q}</button>
            ))}
          </div>
        )}

        <div className="p-4">
          {image && (
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
              <span>📎 {image.name}</span>
              <button onClick={() => setImage(null)} className="text-red-500">remove</button>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-2 py-1.5 shadow-sm">
            <label className="cursor-pointer px-2 text-gray-400 hover:text-gray-600">📎
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
            </label>
            {sttSupported && (
              <button type="button" onClick={startListening} disabled={busy} title="Speak" className={`px-1 ${listening ? "animate-pulse text-red-500" : "text-gray-400 hover:text-gray-600"}`}>🎤</button>
            )}
            {ttsSupported && (
              <button type="button" onClick={() => setSpeak((s) => !s)} title={speak ? "Voice replies on" : "Voice replies off"} className={`px-1 ${speak ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"}`}>{speak ? "🔊" : "🔇"}</button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !busy) { e.preventDefault(); send(); } }}
              placeholder={listening ? "Listening…" : "Describe the issue…."}
              className="flex-1 bg-transparent px-1 text-sm text-[#334155] outline-none placeholder-[#a6a6af]"
            />
            {busy ? (
              <button onClick={stop} title="Stop generating" aria-label="Stop" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F98613] text-white hover:bg-[#e07d0a]">
                <span className="block h-3 w-3 rounded-[2px] bg-white" />
              </button>
            ) : (
              <button onClick={() => send()} aria-label="Send" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F98613] text-white hover:bg-[#e07d0a]">↑</button>
            )}
          </div>
        </div>
      </div>

      {panelOpen && (
        <aside className="flex w-80 shrink-0 flex-col rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="font-semibold">Sources</h3>
            <button onClick={() => setPanelOpen(false)} title="Collapse" className="rounded-md border border-gray-200 px-2 text-gray-500 hover:bg-gray-50">‹</button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {sources.length === 0 ? (
              <p className="p-3 text-sm text-gray-400">No sources yet — ask a question to ground the answer.</p>
            ) : (
              sources.map((s) => {
                const isOpen = expanded === s.key;
                const meta = s.kind === "link" ? domainOf(s.url || "") : `PDF · p. ${s.pages.join(", ")}`;
                return (
                  <div key={s.key} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <button onClick={() => setExpanded(isOpen ? null : s.key)} className="flex w-full items-start gap-3 p-3 text-left hover:bg-gray-50">
                      {s.kind === "link" ? (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500">🌐</span>
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[10px] font-bold text-red-500">PDF</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-gray-900">{s.title}</div>
                        <div className="text-xs text-gray-400">{meta}</div>
                        {!isOpen && s.snippet && <div className="mt-1 line-clamp-2 text-xs text-gray-500">{s.snippet}</div>}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-gray-100 px-3 py-3">
                        {s.kind === "link" ? (
                          <a href={s.url} target="_blank" rel="noreferrer" className="break-all text-xs text-blue-600 underline">{s.url}</a>
                        ) : (
                          <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-600">{s.full}</p>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => copy(s.url || `${API_BASE}/products/${productId}/documents`, `link:${s.key}`)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">{copied === `link:${s.key}` ? "Copied ✓" : "Copy link"}</button>
                          <button onClick={() => copy(s.kind === "link" ? s.title : `(${s.title} p.${s.pages[0]})`, `cite:${s.key}`)} className="rounded-lg border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50">{copied === `cite:${s.key}` ? "Copied ✓" : "Cite source"}</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
