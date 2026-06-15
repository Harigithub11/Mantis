export interface Company {
  id: number;
  name: string;
  email: string;
}

export interface Product {
  id: number;
  company_id: number;
  name: string;
  category: string;
  description: string;
  image_path?: string | null;
  company_name?: string | null;
}

export interface Resource {
  id: number;
  product_id: number;
  type: string; // pdf | doc | image | video | link
  title: string;
  file_path?: string | null;
  url?: string | null;
  indexed: boolean;
  chunk_count: number;
}

export interface Citation {
  source: string;
  page: string;
  quote?: string;
}

export interface Chunk {
  id: string;
  text: string;
  score: number;
  source: string;
  page: string;
}

export interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  image_path?: string | null;
  feedback?: "good" | "bad" | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface ProductAlert {
  id: number;
  product_id: number;
  type: string; // warranty | recall | safety | service
  title: string;
  body: string;
  date?: string | null;
}

export interface MaintenanceSchedule {
  id: number;
  product_id: number;
  task: string;
  interval: string;
  status: string; // suggested | approved
}

export interface NotificationFeedItem {
  id: string;
  type?: string;
  title: string;
  body: string;
  timestamp: string;
  unread?: boolean;
}

export interface ProductInsights {
  session_count: number;
  indexed_docs: number;
  indexed_chunks: number;
  resolution_rate: number | null;
  top_issues: { label: string; count: number }[];
}

export interface ProductAnalytics {
  id: number;
  name: string;
  image_path?: string | null;
  doc_count: number;
  session_count: number;
  resolution_rate: number | null;
  top_issues: { label: string; count: number }[];
}

export interface Analytics {
  products_count: number;
  total_sessions: number;
  indexed_chunks: number;
  resolution_rate: number | null;
  feedback_count: number;
  docs_total: number;
  active_products: number;
  top_concern: string | null;
  products: ProductAnalytics[];
}

// SSE event shapes from POST /products/{id}/chat/{session_id}
export type ChatEvent =
  | { type: "meta"; moss_time_ms: number | null; chunks: Chunk[]; observation?: string | null }
  | { type: "delta"; text: string }
  | { type: "final"; message_id: number; reply: string; asked_followup: boolean; suggestions?: string[]; citations: Citation[] }
  | { type: "done"; message_id?: number };
