"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginCompany, registerCompany, setAuth } from "@/lib/api";

export default function CompanyLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === "register"
          ? await registerCompany(name, email, password)
          : await loginCompany(email, password);
      setAuth(res.token, res.company);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Link href="/login" className="text-sm text-blue-600 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-bold">Company {mode === "register" ? "registration" : "login"}</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex gap-2 text-sm">
          <button
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-1 ${mode === "login" ? "bg-gray-900 text-white" : "text-gray-600"}`}
          >
            Log in
          </button>
          <button
            onClick={() => setMode("register")}
            className={`rounded-md px-3 py-1 ${mode === "register" ? "bg-gray-900 text-white" : "text-gray-600"}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <input
              required
              placeholder="Company name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
            />
          )}
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
          />
          <input
            required
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-gray-900"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {busy ? "…" : mode === "register" ? "Create account" : "Log in"}
          </button>
        </form>
      </div>
    </main>
  );
}
