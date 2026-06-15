// Central API client for the MANTIS FastAPI backend.
import type {
  Analytics,
  ChatEvent,
  ChatMessage,
  Company,
  MaintenanceSchedule,
  NotificationFeedItem,
  Product,
  ProductAlert,
  ProductInsights,
  Resource,
  User,
} from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/** Prefix a backend-relative path (e.g. an /uploads/... image) with the API host. */
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}

// ── Auth token / company (localStorage) ───────────────────────────────────────
const TOKEN_KEY = "mantis_token";
const COMPANY_KEY = "mantis_company";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setAuth(token: string, company: Company) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(COMPANY_KEY, JSON.stringify(company));
}
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(COMPANY_KEY);
}
export function getCompany(): Company | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(COMPANY_KEY);
  return raw ? (JSON.parse(raw) as Company) : null;
}

// ── End-user auth (separate token space) ──────────────────────────────────────
const USER_TOKEN_KEY = "mantis_user_token";
const USER_KEY = "mantis_user";

export function getUserToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_TOKEN_KEY);
}
export function setUserAuth(token: string, user: User) {
  localStorage.setItem(USER_TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearUserAuth() {
  localStorage.removeItem(USER_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function isLoggedIn(): boolean {
  return !!(getToken() || getUserToken());
}
export function logoutAll() {
  clearAuth();
  clearUserAuth();
}

// ── Core fetch helpers ────────────────────────────────────────────────────────
async function request<T>(
  path: string,
  init?: RequestInit,
  auth: boolean | "user" = false
): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (auth) {
    const t = auth === "user" ? getUserToken() : getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  token: string;
  company: Company;
}
export const registerCompany = (name: string, email: string, password: string) =>
  request<AuthResponse>("/companies/register", jsonInit("POST", { name, email, password }));
export const loginCompany = (email: string, password: string) =>
  request<AuthResponse>("/companies/login", jsonInit("POST", { email, password }));

// ── Products ──────────────────────────────────────────────────────────────────
export const listProducts = (q?: string, category?: string) => {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (category) p.set("category", category);
  const qs = p.toString();
  return request<Product[]>(`/products${qs ? `?${qs}` : ""}`);
};
export const getProduct = (id: number) => request<Product>(`/products/${id}`);
export const getInsights = (id: number) => request<ProductInsights>(`/products/${id}/insights`);
export const getAiInsights = (id: number) =>
  request<{ product_id: number; name: string; behaviour_trends: string; growth_suggestion: string }>(
    `/products/${id}/ai-insights`,
    undefined,
    true
  );
export const myProducts = () => request<Product[]>("/companies/me/products", undefined, true);
export const getAnalytics = () => request<Analytics>("/companies/me/analytics", undefined, true);

// ── End users / ownership ─────────────────────────────────────────────────────
export interface UserAuthResponse {
  token: string;
  user: User;
}
export const registerUser = (name: string, email: string, password: string) =>
  request<UserAuthResponse>("/users/register", jsonInit("POST", { name, email, password }));
export const loginUser = (email: string, password: string) =>
  request<UserAuthResponse>("/users/login", jsonInit("POST", { email, password }));
export const addToInventory = (pid: number) =>
  request<void>(`/users/me/inventory/${pid}`, { method: "POST" }, "user");
export const removeFromInventory = (pid: number) =>
  request<void>(`/users/me/inventory/${pid}`, { method: "DELETE" }, "user");
export const listInventory = () => request<Product[]>("/users/me/inventory", undefined, "user");
export const getUserNotifications = () =>
  request<NotificationFeedItem[]>("/users/me/notifications", undefined, "user");

// ── Alerts & maintenance (company-set) ────────────────────────────────────────
export const listAlerts = (pid: number) => request<ProductAlert[]>(`/products/${pid}/alerts`);
export const createAlert = (
  pid: number,
  body: { type: string; title: string; body?: string; date?: string }
) => request<ProductAlert>(`/products/${pid}/alerts`, jsonInit("POST", body), true);
export const deleteAlert = (id: number) => request<void>(`/alerts/${id}`, { method: "DELETE" }, true);
export const listSchedules = (pid: number) =>
  request<MaintenanceSchedule[]>(`/products/${pid}/maintenance`);
export const extractSchedules = (pid: number) =>
  request<MaintenanceSchedule[]>(`/products/${pid}/maintenance/extract`, { method: "POST" }, true);
export const approveSchedule = (id: number) =>
  request<MaintenanceSchedule>(`/maintenance/${id}/approve`, { method: "POST" }, true);
export const deleteSchedule = (id: number) => request<void>(`/maintenance/${id}`, { method: "DELETE" }, true);
export const createProduct = (body: { name: string; category: string; description: string }) =>
  request<Product>("/products", jsonInit("POST", body), true);
export const updateProduct = (
  id: number,
  body: { name?: string; category?: string; description?: string }
) => request<Product>(`/products/${id}`, jsonInit("PUT", body), true);
export const deleteProduct = (id: number) =>
  request<void>(`/products/${id}`, { method: "DELETE" }, true);
export const uploadProductImage = (id: number, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return request<Product>(`/products/${id}/image`, { method: "POST", body: fd }, true);
};

// ── Resources ─────────────────────────────────────────────────────────────────
export const listResources = (productId: number) =>
  request<Resource[]>(`/products/${productId}/resources`);
export const uploadResource = (productId: number, file: File, title?: string) => {
  const fd = new FormData();
  fd.append("file", file);
  if (title) fd.append("title", title);
  return request<Resource>(`/products/${productId}/resources/upload`, { method: "POST", body: fd }, true);
};
export const addLinkResource = (
  productId: number,
  body: { title: string; url: string; type?: string }
) => request<Resource>(`/products/${productId}/resources/link`, jsonInit("POST", body), true);
export const deleteResource = (id: number) =>
  request<void>(`/resources/${id}`, { method: "DELETE" }, true);

// ── Chat ──────────────────────────────────────────────────────────────────────
export const createSession = (productId: number) =>
  request<{ session_id: number; product_id: number }>(
    `/products/${productId}/chat/sessions`,
    { method: "POST" }
  );
export const getMessages = (sessionId: number) =>
  request<ChatMessage[]>(`/chat/${sessionId}/messages`);

/** Record 👍/👎 (or null to clear) on an assistant answer — drives resolution rate. */
export const submitFeedback = (messageId: number, rating: "good" | "bad" | null) =>
  request<{ id: number; feedback: string | null }>(
    `/chat/messages/${messageId}/feedback`,
    jsonInit("POST", { rating })
  );

/** URL for a cited manual page rendered as a PNG (feature A: show the figure). */
export const manualPageUrl = (productId: number, source: string, page: number | string) =>
  `${API_BASE}/products/${productId}/manual-page?source=${encodeURIComponent(source)}&page=${page}`;

/** Stream a chat turn. Calls onEvent for each SSE event (meta/delta/final/done). */
export async function streamChat(
  productId: number,
  sessionId: number,
  question: string,
  image: File | null,
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const fd = new FormData();
  fd.append("question", question);
  if (image) fd.append("image", image);

  const res = await fetch(`${API_BASE}/products/${productId}/chat/${sessionId}`, {
    method: "POST",
    body: fd,
    signal,
  });
  if (!res.body) throw new Error("No response stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);
      if (line.startsWith("data: ")) {
        try {
          onEvent(JSON.parse(line.slice(6)) as ChatEvent);
        } catch {
          // ignore malformed event
        }
      }
    }
  }
}
