"use client";

import { useEffect, useState } from "react";
import {
  approveSchedule,
  createAlert,
  deleteAlert,
  deleteSchedule,
  extractSchedules,
  listAlerts,
  listSchedules,
} from "@/lib/api";
import type { MaintenanceSchedule, ProductAlert } from "@/lib/types";

const ALERT_TYPES = ["warranty", "recall", "safety", "service"] as const;

const TYPE_BADGE: Record<string, string> = {
  recall: "bg-red-50 text-red-700",
  safety: "bg-amber-50 text-amber-700",
  warranty: "bg-blue-50 text-blue-700",
  service: "bg-gray-100 text-gray-600",
};

export default function ProductAlertsManager({ productId }: { productId: number }) {
  const [alerts, setAlerts] = useState<ProductAlert[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [type, setType] = useState<(typeof ALERT_TYPES)[number]>("recall");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);

  function refresh() {
    listAlerts(productId).then(setAlerts).catch(() => {});
    listSchedules(productId).then(setSchedules).catch(() => {});
  }

  useEffect(refresh, [productId]);

  async function addAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createAlert(productId, { type, title, body, date: date || undefined }).catch(() => {});
    setTitle("");
    setBody("");
    setDate("");
    refresh();
  }

  async function runExtract() {
    setExtracting(true);
    setExtractMsg(null);
    try {
      const s = await extractSchedules(productId);
      setExtractMsg(
        s.length ? `Found ${s.length} maintenance task(s) from the manual.` : "No maintenance schedule found in the indexed docs."
      );
      refresh();
    } catch (err) {
      setExtractMsg((err as Error).message);
    } finally {
      setExtracting(false);
    }
  }

  async function approve(id: number) {
    await approveSchedule(id).catch(() => {});
    refresh();
  }
  async function dropSchedule(id: number) {
    await deleteSchedule(id).catch(() => {});
    refresh();
  }
  async function dropAlert(id: number) {
    await deleteAlert(id).catch(() => {});
    refresh();
  }

  const suggested = schedules.filter((s) => s.status !== "approved");
  const approved = schedules.filter((s) => s.status === "approved");

  return (
    <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Alerts */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 font-semibold">Warranty &amp; recall alerts</h2>
        <p className="mb-3 text-xs text-gray-500">
          Owners of this product see these in their notifications.
        </p>

        <form onSubmit={addAlert} className="space-y-2">
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as (typeof ALERT_TYPES)[number])}
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm capitalize outline-none focus:border-gray-900"
            >
              {ALERT_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t}
                </option>
              ))}
            </select>
            <input
              placeholder="Title (e.g. Battery recall)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          </div>
          <textarea
            placeholder="Details for owners…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            rows={2}
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-600 outline-none focus:border-gray-900"
            />
            <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700">
              Publish alert
            </button>
          </div>
        </form>

        <ul className="mt-4 space-y-2">
          {alerts.length === 0 ? (
            <li className="text-sm text-gray-400">No active alerts.</li>
          ) : (
            alerts.map((a) => (
              <li key={a.id} className="flex items-start justify-between rounded-lg border border-gray-100 px-3 py-2">
                <div className="text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TYPE_BADGE[a.type] ?? TYPE_BADGE.service}`}>
                    {a.type}
                  </span>
                  <span className="ml-2 font-medium">{a.title}</span>
                  {a.body && <p className="text-xs text-gray-500">{a.body}</p>}
                </div>
                <button onClick={() => dropAlert(a.id)} className="ml-2 text-xs text-red-500 hover:underline">
                  Delete
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Maintenance */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold">Maintenance schedule</h2>
          <button
            onClick={runExtract}
            disabled={extracting}
            className="rounded-lg border border-[#F5921E] px-3 py-1.5 text-xs font-medium text-[#F5921E] hover:bg-[#F5921E] hover:text-white disabled:opacity-50"
          >
            {extracting ? "Extracting…" : "⚡ Auto-extract from manual"}
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          MOSS finds maintenance passages in the manual; Gemini turns them into tasks. Approve to push reminders to owners.
        </p>
        {extractMsg && <p className="mb-2 text-xs text-gray-600">{extractMsg}</p>}

        {suggested.length > 0 && (
          <>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Suggested</h3>
            <ul className="mb-3 space-y-2">
              {suggested.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium">{s.task}</span>
                    {s.interval && <span className="ml-1 text-xs text-gray-500">· every {s.interval}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => approve(s.id)} className="text-xs font-medium text-emerald-600 hover:underline">
                      Approve
                    </button>
                    <button onClick={() => dropSchedule(s.id)} className="text-xs text-gray-400 hover:text-red-500">
                      Discard
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Active</h3>
        {approved.length === 0 ? (
          <p className="text-sm text-gray-400">No active reminders yet.</p>
        ) : (
          <ul className="space-y-2">
            {approved.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium">{s.task}</span>
                  {s.interval && <span className="ml-1 text-xs text-gray-500">· every {s.interval}</span>}
                </div>
                <button onClick={() => dropSchedule(s.id)} className="text-xs text-gray-400 hover:text-red-500">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
