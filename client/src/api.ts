import axios from "axios";
import type {
  User,
  Article,
  Stats,
  Settings,
  AnalysisResult,
  MaterialCase,
  Note,
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

// Response interceptor:
// 1. Detect error-shaped responses returned with 200 status
//    (Vercel/Upstash runtime can return {code, message} as a 200 body)
// 2. On 401: clear session and notify AuthContext
// 3. Normalize all rejections to have a string .message
api.interceptors.response.use(
  (res) => {
    const d = res.data;
    if (
      d &&
      typeof d === "object" &&
      !Array.isArray(d) &&
      "code" in d &&
      "message" in d
    ) {
      // Check if this looks like an error object, not legitimate API data
      const keys = Object.keys(d);
      const errorLikeKeys = [
        "code",
        "message",
        "error",
        "stack",
        "name",
        "type",
        "statusCode",
      ];
      const isErrorResponse =
        keys.length <= 4 && keys.every((k) => errorLikeKeys.includes(k));
      if (isErrorResponse) {
        console.error("[API] Error-shaped response with 200 status:", d);
        const error = new Error(d.message || "服务器错误");
        (error as any).response = {
          data: { error: d.message || "服务器错误" },
          status: 500,
        };
        return Promise.reject(error);
      }
    }
    return res;
  },
  (err) => {
    // 401 handling (before normalization, while we still have the original error)
    if (err.response?.status === 401) {
      const msg = err.response?.data?.error || "";
      const isAuthError =
        /未登录|登录已过期|用户不存在|unauthorized|invalid token|token/i.test(
          msg
        );
      if (isAuthError) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
    }
    // Normalize error to always have a string .message
    // Defensive: ensure downstream components never read an object error.
    if (
      err?.response?.data &&
      typeof err.response.data.error === "object"
    ) {
      err.response.data.error = JSON.stringify(err.response.data.error);
    }
    const data = err?.response?.data;
    let msg =
      (typeof data?.error === "string" ? data.error : undefined) ||
      (typeof data?.message === "string" ? data.message : undefined) ||
      err?.message ||
      "网络请求失败";
    // 拼接后端附带的真实诊断字段，避免出错原因被吞掉看不到
    if (data && typeof data === "object") {
      const extra = [];
      if (data.reason && data.reason !== msg && String(data.reason).length < 200)
        extra.push(String(data.reason));
      if (data.detail) extra.push(String(data.detail).slice(0, 200));
      if (data.raw) extra.push(String(data.raw).slice(0, 200));
      if (data.path) extra.push("path=" + data.path);
      if (extra.length) msg = msg + " ｜ " + extra.join(" ｜ ");
    }
    const normalizedError = new Error(msg);
    // Preserve response for components that access it
    if (err.response) {
      (normalizedError as any).response = err.response;
    }
    return Promise.reject(normalizedError);
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
  update: (articleId: number, linkId: string, data: Partial<MaterialCase>) =>
    api
      .put<{ success: boolean; card: MaterialCase }>(
        `/materials/${articleId}/${linkId}`,
        data
      )
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
  update: (id: number, data: { question?: string; type?: string; answerIdea?: string }) =>
    api
      .put<{ success: boolean; question: any }>(`/interview-questions/${id}`, data)
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
    linkId?: string | null;
    tags?: string[];
  }) =>
    api.post<{ success: boolean; quote: any }>("/quotes", data).then((r) => r.data),
  update: (id: number, data: { quote?: string; source?: string; tags?: string[] }) =>
    api
      .put<{ success: boolean; quote: any }>(`/quotes/${id}`, data)
      .then((r) => r.data),
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
    linkId?: string | null;
  }) =>
    api
      .post<{ success: boolean; method: any }>("/solution-methods", data)
      .then((r) => r.data),
  update: (id: number, data: { heading?: string; content?: string; domain?: string; tags?: string[] }) =>
    api
      .put<{ success: boolean; method: any }>(`/solution-methods/${id}`, data)
      .then((r) => r.data),
};

// ===== Notes (随手记) =====
export const noteApi = {
  list: () => api.get<Note[]>("/notes").then((r) => r.data),
  get: (id: number) =>
    api.get<Note>(`/notes/${id}`).then((r) => r.data),
  create: (data: { title: string; content: string }) =>
    api
      .post<{ success: boolean; note: Note }>("/notes", data)
      .then((r) => r.data),
  update: (id: number, data: { title: string; content: string }) =>
    api
      .put<{ success: boolean; note: Note }>(`/notes/${id}`, data)
      .then((r) => r.data),
  delete: (id: number) =>
    api.delete(`/notes/${id}`).then((r) => r.data),
};
