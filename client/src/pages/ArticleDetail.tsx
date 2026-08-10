import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { articleApi, quotesApi, solutionApi } from "../api";
import EditableAnalysisView from "../components/EditableAnalysisView";
import type { Article, AnalysisResult, AnalysisPoint, GoldenQuote } from "../types";

// Compatible: accept both string (old) and AnalysisPoint[] (new)
function toPoints(val: any): AnalysisPoint[] {
  if (typeof val === "string") return val.trim() ? [{ heading: "", content: val }] : [];
  if (Array.isArray(val)) return val;
  return [];
}

function toResult(article: Article): AnalysisResult {
  return {
    background: article.background || "",
    phenomenonAnalysis: toPoints(article.phenomenonAnalysis),
    solutions: toPoints(article.solutions),
    goldenQuotes: article.goldenQuotes || [],
    materialCases: article.materialCases || [],
    interviewQuestion: article.interviewQuestion,
  };
}

export default function ArticleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [draft, setDraft] = useState<AnalysisResult | null>(null);

  const [savedQuotes, setSavedQuotes] = useState<Set<number>>(new Set());
  const [savedSolutions, setSavedSolutions] = useState<Set<number>>(new Set());

  const load = () => {
    articleApi
      .get(parseInt(id!))
      .then((a) => {
        setArticle(a);
        setDraft(toResult(a));
        setEditTitle(a.title);
        setEditContent(a.content);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const enterEdit = () => {
    if (!article) return;
    setDraft(toResult(article));
    setEditTitle(article.title);
    setEditContent(article.content);
    setDirty(false);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDirty(false);
    if (article) {
      setDraft(toResult(article));
      setEditTitle(article.title);
      setEditContent(article.content);
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定删除这篇文章及其拆解结果？此操作不可撤销。")) return;
    setDeleting(true);
    try {
      await articleApi.delete(parseInt(id!));
      navigate("/articles");
    } catch {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const updated = await articleApi.update(parseInt(id!), {
        title: editTitle || "未命名文章",
        content: editContent,
        background: draft.background,
        phenomenonAnalysis: draft.phenomenonAnalysis,
        solutions: draft.solutions,
        goldenQuotes: draft.goldenQuotes,
        materialCases: draft.materialCases,
        interviewQuestion: draft.interviewQuestion,
      });
      setArticle(updated);
      setDraft(toResult(updated));
      setEditTitle(updated.title);
      setEditContent(updated.content);
      setEditing(false);
      setDirty(false);
    } catch {
      alert("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuote = async (q: GoldenQuote, i: number, linkId?: string | null) => {
    if (!q.quote.trim() || !article) return;
    try {
      await quotesApi.save({
        quote: q.quote,
        source: q.source,
        articleId: article.id,
        articleTitle: article.title,
        linkId: linkId ?? null,
      });
      setSavedQuotes((prev) => new Set(prev).add(i));
    } catch {
      alert("金句收藏失败，请重试");
    }
  };

  const handleSaveSolution = async (
    p: AnalysisPoint,
    domain: string,
    tags: string[],
    i: number,
    linkId?: string | null
  ) => {
    if (!p.content.trim() || !article) return;
    try {
      await solutionApi.save({
        heading: p.heading,
        content: p.content,
        domain,
        tags,
        articleId: article.id,
        articleTitle: article.title,
        linkId: linkId ?? null,
      });
      setSavedSolutions((prev) => new Set(prev).add(i));
    } catch {
      alert("解决方法收藏失败，请重试");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!article || !draft) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink-500 mb-4">文章不存在或已被删除</p>
        <Link to="/articles" className="btn-primary">返回列表</Link>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-2rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/articles" className="text-ink-400 hover:text-ink-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            {editing ? (
              <input
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  setDirty(true);
                }}
                className="input-field text-xl font-bold text-ink-900 ink-title"
                placeholder="文章标题"
              />
            ) : (
              <>
                <h1 className="text-xl font-bold text-ink-900 ink-title">{article.title}</h1>
                <p className="text-sm text-ink-400 mt-0.5">
                  {new Date(article.createdAt).toLocaleString("zh-CN")}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          {!editing ? (
            <>
              <button onClick={enterEdit} className="btn-secondary">编辑</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger">
                {deleting ? "删除中..." : "删除"}
              </button>
            </>
          ) : (
            <>
              <button onClick={cancelEdit} className="btn-secondary" disabled={saving}>
                取消
              </button>
              <button onClick={handleSave} disabled={saving || !dirty} className="btn-primary">
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存修改"
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dual pane */}
      <div className="flex-1 min-h-0 flex gap-5">
        {/* Left: original article */}
        <div className="w-[42%] card p-5 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-ink-200/60">
            <span className="text-lg">📖</span>
            <h3 className="text-sm font-semibold text-ink-700 ink-title">原文</h3>
            <span className="text-xs text-ink-400 ml-auto">{editContent.length} 字</span>
          </div>
          {editing ? (
            <textarea
              value={editContent}
              onChange={(e) => {
                setEditContent(e.target.value);
                setDirty(true);
              }}
              className="input-field min-h-[200px] resize-y font-serif leading-relaxed"
              placeholder="文章原文..."
            />
          ) : (
            <pre className="text-sm text-ink-700 whitespace-pre-wrap font-serif leading-relaxed">
              {article.content}
            </pre>
          )}
        </div>

        {/* Right: structured analysis */}
        <div className="flex-1 overflow-y-auto pr-1">
          <EditableAnalysisView
            result={draft}
            editable={editing}
            onChange={(patch) => {
              setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
              setDirty(true);
            }}
            savedQuotes={savedQuotes}
            onSaveQuote={handleSaveQuote}
            savedSolutions={savedSolutions}
            onSaveSolution={handleSaveSolution}
          />
        </div>
      </div>
    </div>
  );
}
