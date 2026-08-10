import axios from "axios";
import type {
  User,
  Article,
  Stats,
  Settings,
  AnalysisResult,
  MaterialCase,
} from "./types";

const api = axios.create({
  baseURL: "/api",
});

// Auto-attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: clear stored session and notify AuthContext to handle logout
// gracefully (via React Router) instead of a silent full-page reload that
// would destroy any in-progress work (e.g. a pasted article).
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Only treat a 401 as a session-expiry when it actually comes from our
      // own auth layer (these responses carry an auth-related error message).
      // Third-party upstream failures (e.g. an AI provider returning 401 for a
      // bad API key, surfaced via /api/analyze as 502) must NOT log the user
      // out — they are surfaced per-request as error messages instead.
      const msg = err.response?.data?.error || "";
      const isAuthError =
        /未登录|登录已过期|用户不存在|unauthorized|invalid token|token/i.test(msg);
      if (isAuthError) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
    }
    return Promise.reject(err);
  }
);

// ===== Auth =====
export const authApi = {
  register: (username: string, password: string) =>
    api
      .post<{ token: string; user: User }>("/auth/register", {
        username,
        password,
      })
      .then((r) => r.data),

  login: (username: string, password: string) =>
    api
      .post<{ token: string; user: User }>("/auth/login", {
        username,
        password,
      })
      .then((r) => r.data),

  me: () =>
    api.get<{ user: User }>("/auth/me").then((r) => r.data.user),
};

// ===== Articles =====
export const articleApi = {
  list: () => api.get<Article[]>("/articles").then((r) => r.data),
  get: (id: number) =>
    api.get<Article>(`/articles/${id}`).then((r) => r.data),
  create: (data: Partial<Article>) =>
    api.post<Article>("/articles", data).then((r) => r.data),
  update: (id: number, data: Partial<Article>) =>
    api.put<Article>(`/articles/${id}`, data).then((r) => r.data),
  delete: (id: number) =>
    api.delete(`/articles/${id}`).then((r) => r.data),
};

// ===== Stats =====
export const statsApi = {
  get: () => api.get<Stats>("/stats").then((r) => r.data),
};

// ===== Materials =====
export const materialApi = {
  search: (query: string) =>
    api
      .get<MaterialCase[]>("/materials/search", { params: { q: query } })
      .then((r) => r.data),
};

// ===== Settings =====
export const settingsApi = {
  get: () => api.get<Settings>("/settings").then((r) => r.data),
  update: (data: Partial<Settings>) =>
    api.put<Settings>("/settings", data).then((r) => r.data),
};

// ===== Analyze =====
export const analyzeApi = {
  analyze: (content: string) =>
    api.post<AnalysisResult>("/analyze", { content }).then((r) => r.data),
  fetchUrl: (url: string) =>
    api
      .post<{ title: string; content: string; url: string }>("/fetch-url", { url })
      .then((r) => r.data),
};

// ===== Interview Questions (面试题目库) =====
export const interviewApi = {
  list: (params?: { q?: string; type?: string }) =>
    api
      .get<any[]>("/interview-questions", { params: params || {} })
      .then((r) => r.data),
};

// ===== Quotes (金句库) =====
export const quotesApi = {
  list: (params?: { q?: string; tag?: string }) =>
    api.get<any[]>("/quotes", { params: params || {} }).then((r) => r.data),
  save: (data: {
    quote: string;
    source?: string;
    articleId?: number;
    articleTitle?: string;
    tags?: string[];
  }) =>
    api.post<{ success: boolean; quote: any }>("/quotes", data).then((r) => r.data),
};

// ===== Solution Methods (解决方法库) =====
export const solutionApi = {
  list: (params?: { q?: string; domain?: string }) =>
    api
      .get<any[]>("/solution-methods", { params: params || {} })
      .then((r) => r.data),
  save: (data: {
    heading?: string;
    content: string;
    domain: string;
    tags?: string[];
    articleId?: number;
    articleTitle?: string;
  }) =>
    api
      .post<{ success: boolean; method: any }>("/solution-methods", data)
      .then((r) => r.data),
};
