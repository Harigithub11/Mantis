"use client";

import Link from "next/link";
import { useState } from "react";

export interface MarketProduct {
  id: string;
  brand: string;
  name: string;
  imageSrc?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  unread?: boolean;
}

interface MarketplaceProps {
  products?: MarketProduct[];
  notifications?: NotificationItem[];
  currentPage?: number;
  totalPages?: number;
  categories?: string[];
  activeCategory?: string;
  onCategoryChange?: (cat: string) => void;
  onViewProduct?: (id: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onLogIn?: () => void;
  onLogout?: () => void;
  authed?: boolean;
  onSearch?: (q: string) => void;
  onMarkAllRead?: () => void;
}

const MANTIS_PATH =
  "M20.4306 0.0191502C20.5179 0.00955237 20.6104 0.000941842 20.6979 0C21.5522 0.00130064 22.3722 0.451501 22.9819 1.254C23.7378 2.2676 23.9343 3.44382 23.9082 4.82542C23.8938 5.58894 23.9084 6.39049 23.9077 7.15715L23.9068 13.7865C24.3304 13.2149 24.8927 12.5968 25.3525 12.0612L27.6638 9.35886L34.6217 1.22928C35.3401 0.403647 36.0668 -0.0867394 37.0446 0.0171772C37.9104 0.103513 38.7144 0.649512 39.2789 1.53404C39.824 2.3978 39.9936 3.39117 39.9946 4.50609C39.9952 5.37648 39.9952 6.24796 39.9949 7.11849L39.9922 13.6722L39.9949 21.9732C39.9959 23.391 40.0143 24.8764 39.9745 26.2877C39.94 27.5224 39.4652 28.6657 38.7555 29.4645C37.9415 30.3741 36.8911 30.8113 35.836 30.6793C34.7816 30.5472 33.7576 29.7891 33.0861 28.693C32.4229 27.5907 32.1122 26.1811 32.2223 24.7726C32.4423 21.9209 34.2171 20.565 35.6902 18.7957C36.6982 17.5851 37.7666 16.3 38.8137 15.1582C38.2392 14.6698 37.7496 14.3422 37.0577 14.2753C36.4326 14.2085 35.8076 14.403 35.2685 14.832C34.8742 15.14 34.3565 15.7816 33.9984 16.202L32.3132 18.1768L26.0277 25.5243C24.0922 27.5028 22.2372 31.1713 19.5831 30.6519C18.5053 30.4482 17.5324 29.677 16.8797 28.5088C16.2156 27.3119 16.0111 25.976 16.1556 24.5061C16.3576 22.4509 17.2984 21.4661 18.3887 20.1957L20.0051 18.3111L21.6613 16.3742C21.9914 15.9883 22.3702 15.5214 22.717 15.1772C20.1062 12.7887 18.5792 15.4326 16.702 17.6056L9.46198 26.0644L7.60487 28.2377C7.19233 28.7246 6.66535 29.3818 6.22257 29.785C5.75458 30.2175 5.22131 30.5064 4.66066 30.6313C3.58867 30.8534 2.49478 30.4951 1.61983 29.6352C0.772472 28.8007 0.206464 27.5496 0.0459081 26.1562C-0.115082 24.7415 0.152053 23.3105 0.773275 22.1414C1.10439 21.5183 1.71765 20.8636 2.16253 20.3409L3.94025 18.263L9.78386 11.4394L15.8633 4.3336L17.7346 2.14978C18.6765 1.0441 19.1346 0.2743 20.4306 0.0191502Z";

function NotificationPanel({ notifications, onMarkAllRead }: { notifications: NotificationItem[]; onMarkAllRead?: () => void }) {
  return (
    <div className="absolute right-0 top-12 z-50 w-[380px] overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0px_12px_28px_-8px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f9fafb] px-5 py-4">
        <h2 className="text-[16px] font-semibold text-[#111827]">Notifications</h2>
        <button onClick={onMarkAllRead} className="text-[13px] font-medium text-[#3b82f6] underline">Mark all as read</button>
      </div>
      {notifications.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-400">You&apos;re all caught up.</p>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto">
          {notifications.map((n, i) => (
            <li key={n.id} className={i < notifications.length - 1 ? "border-b border-[#f1f5f9]" : ""}>
              <div className="flex flex-col gap-1 px-5 py-3.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[14px] ${n.unread ? "font-semibold text-[#111827]" : "font-medium text-[#374151]"}`}>{n.title}</span>
                  {n.unread && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-[#ef4444]" />}
                </div>
                <p className="text-[13px] leading-[1.5] text-[#6b7280]">{n.body}</p>
                <p className="text-[12px] text-[#9ca3af]">{n.timestamp}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Marketplace({
  products = [],
  notifications = [],
  currentPage = 1,
  totalPages = 1,
  categories = ["All"],
  activeCategory = "All",
  onCategoryChange,
  onViewProduct,
  onPrev,
  onNext,
  onLogIn,
  onLogout,
  authed,
  onSearch,
  onMarkAllRead,
}: MarketplaceProps) {
  const [searchValue, setSearchValue] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="bg-[#181818] flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <svg width="28" height="22" viewBox="0 0 40 30.7024" fill="none" aria-hidden="true">
            <path d={MANTIS_PATH} fill="#F98613" />
          </svg>
          <span className="text-white font-bold italic text-xl tracking-wide">MANTIS</span>
        </Link>
        <button
          onClick={authed ? onLogout : onLogIn}
          className="border border-[#ffa33c] text-[#ffa33c] px-5 py-2 rounded-lg text-sm font-medium hover:bg-[rgba(255,163,60,0.1)] transition-colors"
        >
          {authed ? "Log Out" : "Log In"}
        </button>
      </nav>

      <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8 max-w-screen-xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>

          <div className="flex items-center gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSearch?.(searchValue);
              }}
              role="search"
              className="flex items-center gap-3 rounded-full border border-[#e2e8f0] bg-[#f0f5f9] px-4 py-2 w-full sm:w-80 focus-within:border-[#F98613]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" aria-hidden className="shrink-0">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                placeholder="Search products..."
                value={searchValue}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                  onSearch?.(e.target.value);
                }}
                className="w-full bg-transparent text-sm text-[#0a1628] placeholder-[#64748b] focus:outline-none"
                aria-label="Search products"
              />
            </form>

            {/* Notification bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                aria-label="Notifications"
                aria-expanded={panelOpen}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              {panelOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPanelOpen(false)} />
                  <NotificationPanel notifications={notifications} onMarkAllRead={onMarkAllRead} />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8" role="list" aria-label="Product categories">
          {categories.map((cat) => {
            const isActive = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => onCategoryChange?.(cat)}
                aria-pressed={isActive}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border capitalize transition-colors ${
                  isActive
                    ? "bg-[#F98613] border-[#F98613] text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:border-[#F98613] hover:text-[#F98613]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-10" aria-label="Products">
          {products.map((product) => (
            <article key={product.id} className="flex flex-col border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <div className="w-full aspect-square border-b border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                {product.imageSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageSrc} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl text-gray-300">📦</span>
                )}
              </div>
              <div className="flex flex-col flex-1 p-3 gap-1">
                <p className="text-xs text-gray-500 truncate">{product.brand}</p>
                <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 flex-1">{product.name}</p>
                <button
                  onClick={() => onViewProduct?.(product.id)}
                  className="mt-2 border border-[#ffa33c] text-[#F98613] hover:bg-[rgba(255,163,60,0.1)] text-xs font-medium py-1.5 rounded-lg transition-colors"
                  aria-label={`View ${product.name}`}
                >
                  View
                </button>
              </div>
            </article>
          ))}
        </div>

        {products.length === 0 && <p className="text-center text-gray-400">No products found.</p>}

        <div className="flex items-center justify-between">
          <button onClick={onPrev} disabled={currentPage <= 1} className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            ← Prev
          </button>
          <p className="text-sm text-gray-600" aria-live="polite">Page {currentPage} of {totalPages}</p>
          <button onClick={onNext} disabled={currentPage >= totalPages} className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      </main>
    </div>
  );
}
