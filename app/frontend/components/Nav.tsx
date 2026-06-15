"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCompany, getUser, logoutAll } from "@/lib/api";
import type { Company, User } from "@/lib/types";

export default function Nav() {
  const [company, setCompany] = useState<Company | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setCompany(getCompany());
    setUser(getUser());
  }, [pathname]);

  function logout() {
    logoutAll();
    setCompany(null);
    setUser(null);
    router.push("/");
  }

  const authed = !!(company || user);

  // These pages have their own navbar (or sidebar) — hide the public top nav there.
  if (
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/login") ||
    pathname === "/" ||
    pathname === "/products"
  )
    return null;

  return (
    <header className="bg-[#16163E] text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-extrabold italic tracking-tight">
            <span className="text-[#F5921E]">M</span>ANTIS
          </span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {company && (
            <Link href="/dashboard" className="text-gray-200 hover:text-white">
              Dashboard
            </Link>
          )}
          {user && (
            <Link href="/account" className="text-gray-200 hover:text-white">
              My Products
            </Link>
          )}
          {authed ? (
            <>
              <span className="hidden text-gray-400 sm:inline">{company?.name ?? user?.name}</span>
              <button
                onClick={logout}
                className="rounded-full border border-[#F5921E] px-4 py-1.5 text-[#F5921E] hover:bg-[#F5921E] hover:text-white"
              >
                Log Out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-[#F5921E] px-5 py-1.5 text-[#F5921E] hover:bg-[#F5921E] hover:text-white"
            >
              Log In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
