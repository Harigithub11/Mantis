"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCompany, getUser, logoutAll } from "@/lib/api";
import type { Company, User } from "@/lib/types";

const MANTIS_PATH =
  "M20.4306 0.0191502C20.5179 0.00955237 20.6104 0.000941842 20.6979 0C21.5522 0.00130064 22.3722 0.451501 22.9819 1.254C23.7378 2.2676 23.9343 3.44382 23.9082 4.82542C23.8938 5.58894 23.9084 6.39049 23.9077 7.15715L23.9068 13.7865C24.3304 13.2149 24.8927 12.5968 25.3525 12.0612L27.6638 9.35886L34.6217 1.22928C35.3401 0.403647 36.0668 -0.0867394 37.0446 0.0171772C37.9104 0.103513 38.7144 0.649512 39.2789 1.53404C39.824 2.3978 39.9936 3.39117 39.9946 4.50609C39.9952 5.37648 39.9952 6.24796 39.9949 7.11849L39.9922 13.6722L39.9949 21.9732C39.9959 23.391 40.0143 24.8764 39.9745 26.2877C39.94 27.5224 39.4652 28.6657 38.7555 29.4645C37.9415 30.3741 36.8911 30.8113 35.836 30.6793C34.7816 30.5472 33.7576 29.7891 33.0861 28.693C32.4229 27.5907 32.1122 26.1811 32.2223 24.7726C32.4423 21.9209 34.2171 20.565 35.6902 18.7957C36.6982 17.5851 37.7666 16.3 38.8137 15.1582C38.2392 14.6698 37.7496 14.3422 37.0577 14.2753C36.4326 14.2085 35.8076 14.403 35.2685 14.832C34.8742 15.14 34.3565 15.7816 33.9984 16.202L32.3132 18.1768L26.0277 25.5243C24.0922 27.5028 22.2372 31.1713 19.5831 30.6519C18.5053 30.4482 17.5324 29.677 16.8797 28.5088C16.2156 27.3119 16.0111 25.976 16.1556 24.5061C16.3576 22.4509 17.2984 21.4661 18.3887 20.1957L20.0051 18.3111L21.6613 16.3742C21.9914 15.9883 22.3702 15.5214 22.717 15.1772C20.1062 12.7887 18.5792 15.4326 16.702 17.6056L9.46198 26.0644L7.60487 28.2377C7.19233 28.7246 6.66535 29.3818 6.22257 29.785C5.75458 30.2175 5.22131 30.5064 4.66066 30.6313C3.58867 30.8534 2.49478 30.4951 1.61983 29.6352C0.772472 28.8007 0.206464 27.5496 0.0459081 26.1562C-0.115082 24.7415 0.152053 23.3105 0.773275 22.1414C1.10439 21.5183 1.71765 20.8636 2.16253 20.3409L3.94025 18.263L9.78386 11.4394L15.8633 4.3336L17.7346 2.14978C18.6765 1.0441 19.1346 0.2743 20.4306 0.0191502Z";

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
          <svg width="28" height="22" viewBox="0 0 40 30.7024" fill="none" aria-hidden>
            <path d={MANTIS_PATH} fill="#F98613" />
          </svg>
          <span className="text-xl font-bold italic tracking-wide">MANTIS</span>
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
