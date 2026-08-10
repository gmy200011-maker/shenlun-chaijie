import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeApi, articleApi, quotesApi, solutionApi } from "../api";
import EditableAnalysisView from "../components/EditableAnalysisView";
import type {
  AnalysisResult,
  GoldenQuote,
  AnalysisPoint,
} from "../types";

type Step = "input" | "analyzing" | "result";
type InputMode = "text" | "url";

const DRAFT_KEY = "analyze_draft";

// Normalize: AI may occasionally return a plain string; wrap into AnalysisPoint[]
function normalizePoints(data: any): AnalysisPoint[] {
  if (typeof data === "string") return data.trim() ? [{ heading: "", content: data }] : [];
  if (Array.isArray(data)) return data.map((p: any) => ({
    heading: p?.heading || "",
    content: p?.content || "",
  }));
  return [];
}

// Restore an unsaved draft (survives reload / accidental redirect to login)
function loadDraft(): { content: string; title: string; url: string; mode: InputMode } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.content !== "string") return null;
    return {
      content: d.content || "",
      title: d.title || "",
      url: d.url || "",
      mode: d.mode === "url" ? "url" : "text",
    };
  } catch {
    return null;
  }
}

function saveDraft(d: { content: string; title: string; url: string; mode: InputMode }) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* ignore quota errors */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export default function Analyze() {
  const navigate = useNavigate();
  const draft = loadDraft();
  const [step, setStep] = useState<Step>("input");
  const [mode, setMode] = useState<InputMode>(draft?.mode || "url");
  const [content, setContent] = useState(draft?.content || "");
  const [title, setTitle] = useState(draft?.title || "");
  const [url, setUrl] = useState(draft?.url || "");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<Set<number>>(new Set());
  const [savedSolutions, setSavedSolutions] = useState<Set<number>>(new Set());

  // Persist the input draft so it survives a reload or an auth redirect
  useEffect(() => {
    saveDraft({ content, title, url, mode });
  }, [content, title, url, mode]);

  // ===== URL fetch =====
  const handleFetchUrl = async () => {
    if (!url.trim()) {
      setError("请输入文章链接");
      return;
    }
    setError("");
    setFetchingUrl(true);
    try {
      const data = await analyzeApi.fetchUrl(url.trim());
      setContent(data.content);
      if (data.title) setTitle(data.title);
    } catch (err: any) {
      setError(err.response?.data?.error || "抓取网页失败，请检查链接");
    } finally {
      setFetchingUrl(false);
    }
  };

  // ===== Analyze =====
  const handleAnalyze = async () => {
    if (content.trim().length < 50) {
      setError("文章内容过短，请至少输入50个字符");
      return;
    }
    setError("");
    setStep("analyzing");
    try {
      const data = await analyzeApi.analyze(content);
      const normalized: AnalysisResult = {
        ...data,
        phenomenonAnalysis: normalizePoints(data.phenomenonAnalysis),
        solutions: normalizePoints(data.solutions),
      };
      setResult(normalized);
      setStep("result");
    } catch (err: any) {
      const errData = err.response?.data;
      const errMsg = errData?.error || "分析失败，请重试";
      const errDetail = errData?.detail || errData?.raw || "";
      setError(errDetail ? `${errMsg}\n${errDetail}` : errMsg);
      setStep("input");
    }
  };

  // ===== Save =====
  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const article = await articleApi.create({
        title: title || "未命名文章",
        content,
        background: result.background,
        phenomenonAnalysis: result.phenomenonAnalysis,
        solutions: result.solutions,
        goldenQuotes: result.goldenQuotes,
        materialCases: result.materialCases,
        interviewQuestion: result.interviewQuestion,
      });
      clearDraft();
      navigate(`/articles/${article.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep("input");
    setContent("");
    setTitle("");
    setUrl("");
    setResult(null);
    setError("");
    setSavedQuotes(new Set());
    setSavedSolutions(new Set());
    clearDraft();
  };

  const updateResult = (patch: Partial<AnalysisResult>) => {
    setResult((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  // ===== Save single quote to 金句库 =====
  const handleSaveQuote = async (q: GoldenQuote, i: number) => {
    if (!q.quote.trim()) return;
    try {
      await quotesApi.save({ quote: q.quote, source: q.source });
      setSavedQuotes((prev) => new Set(prev).add(i));
    } catch {
      setError("金句收藏失败，请重试");
    }
  };

  // ===== Save a solution method to 解决方法库 =====
  const handleSaveSolution = async (
    p: AnalysisPoint,
    domain: string,
    tags: string[],
    i: number
  ) => {
    if (!p.content.trim()) return;
    try {
      await solutionApi.save({
        heading: p.heading,
        content: p.content,
        domain,
        tags,
        articleTitle: title || "未命名文章",
      });
      setSavedSolutions((prev) => new Set(prev).add(i));
    } catch {
      setError("解决方法收藏失败，请重试");
    }
  };

  // ===== Input Step =====
  if (step === "input") {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink-900 ink-title">文章拆解</h1>
          <p className="text-sm text-ink-500 mt-1">
            粘贴文章全文或输入网页链接，AI将自动拆解并生成面试题目
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-seal-50 border border-seal-200 text-sm text-seal-700 whitespace-pre-line">
            {error}
            {(error.includes("API密钥") || error.includes("AI服务返回错误")) && (
              <a href="/settings" className="underline ml-1 font-medium">
                去设置检查密钥/模型 →
              </a>
            )}
          </div>
        )}

        <div className="card p-6 space-y-4">
          <div className="flex gap-2 pb-2">
            <button
              onClick={() => setMode("text")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === "text"
                  ? "bg-brand-700 text-white shadow-sm"
                  : "bg-ink-50 text-ink-600 hover:bg-ink-100"
              }`}
            >
              📝 粘贴文本
            </button>
            <button
              onClick={() => setMode("url")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === "url"
                  ? "bg-brand-700 text-white shadow-sm"
                  : "bg-ink-50 text-ink-600 hover:bg-ink-100"
              }`}
            >
              🔗 输入链接
            </button>
          </div>

          {mode === "url" && (
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">
                文章链接
              </label>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="input-field flex-1"
                  placeholder="https://mp.weixin.qq.com/s/..."
                  onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
                />
                <button
                  onClick={handleFetchUrl}
                  disabled={fetchingUrl || !url.trim()}
                  className="btn-secondary whitespace-nowrap"
                >
                  {fetchingUrl ? (
                    <>
                      <span className="w-4 h-4 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                      抓取中...
                    </>
                  ) : (
                    "抓取文章"
                  )}
                </button>
              </div>
              <p className="text-xs text-ink-400 mt-1.5">
                支持微信公众号文章链接，自动去除版权声明等尾部内容
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              文章标题（可选）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field"
              placeholder="如：浙江宣传文章标题"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              文章全文
              {mode === "url" && content && (
                <span className="text-brand-600 ml-2">✓ 已从链接抓取</span>
              )}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input-field min-h-[400px] resize-y font-serif leading-relaxed"
              placeholder={
                mode === "url"
                  ? "点击「抓取文章」后，内容将显示在此处，可手动编辑..."
                  : "在此粘贴文章全文..."
              }
            />
            <div className="mt-1.5 text-xs text-ink-400 text-right">
              {content.length} 字
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-400">
              {mode === "url"
                ? "抓取后可编辑内容再拆解，AI分析需要配置API密钥"
                : "提示：AI分析需要配置API密钥，可在设置页面配置"}
            </p>
            <button
              onClick={handleAnalyze}
              disabled={content.trim().length < 50}
              className="btn-primary"
            >
              开始拆解
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== Analyzing Step =====
  if (step === "analyzing") {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="card p-12 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-semibold text-ink-900 mb-2 ink-title">
            正在拆解文章...
          </h2>
          <p className="text-sm text-ink-500">
            AI正在分析写作背景、现象剖析、解决方法，生成面试题目
          </p>
          <p className="text-xs text-ink-400 mt-2">通常需要10-30秒</p>
        </div>
      </div>
    );
  }

  // ===== Result Step (Dual Pane) =====
  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-ink-900 ink-title">拆解结果 · 对照阅读</h1>
          <p className="text-xs text-ink-500 mt-1">
            左栏原文，右栏拆解结果，两侧可独立滚动 · 可直接编辑修改
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleReset} className="btn-secondary">
            重新拆解
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                保存中...
              </>
            ) : (
              "保存文章与面试题"
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-4 py-3 rounded-lg bg-seal-50 border border-seal-200 text-sm text-seal-700 shrink-0">
          {error}
        </div>
      )}

      {/* Dual pane */}
      <div className="flex-1 min-h-0 flex gap-5">
        {/* Left: original article */}
        <div className="w-[42%] card p-5 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-ink-200/60">
            <span className="text-lg">📖</span>
            <h3 className="text-sm font-semibold text-ink-700 ink-title">原文</h3>
            <span className="text-xs text-ink-400 ml-auto">{content.length} 字</span>
          </div>
          <pre className="text-sm text-ink-700 whitespace-pre-wrap font-serif leading-relaxed">
            {content}
          </pre>
        </div>

        {/* Right: structured analysis */}
        <div className="flex-1 overflow-y-auto pr-1">
          {result && (
            <EditableAnalysisView
              result={result}
              onChange={updateResult}
              savedQuotes={savedQuotes}
              onSaveQuote={handleSaveQuote}
              savedSolutions={savedSolutions}
              onSaveSolution={handleSaveSolution}
            />
          )}
        </div>
      </div>
    </div>
  );
}
