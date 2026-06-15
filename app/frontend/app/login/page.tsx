"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LoginPage from "@/components/LoginPage";
import {
  isLoggedIn,
  loginCompany,
  loginUser,
  logoutAll,
  registerUser,
  setAuth,
  setUserAuth,
} from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(isLoggedIn());
  }, []);

  async function onSignIn(accountType: "user" | "company", email: string, password: string) {
    setError(null);
    setBusy(true);
    try {
      if (accountType === "user") {
        // Frictionless end-user accounts: log in if it exists, otherwise create it.
        let res;
        try {
          res = await loginUser(email, password);
        } catch {
          res = await registerUser(email.split("@")[0] || "User", email, password);
        }
        setUserAuth(res.token, res.user);
        router.push("/products");
      } else {
        const res = await loginCompany(email, password);
        setAuth(res.token, res.company);
        router.push("/dashboard");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <LoginPage
      error={error}
      busy={busy}
      authed={authed}
      onSignIn={onSignIn}
      onRegister={() => router.push("/login/company")}
      onForgotPassword={() => {}}
      onLogout={() => {
        logoutAll();
        setAuthed(false);
        router.refresh();
      }}
    />
  );
}
