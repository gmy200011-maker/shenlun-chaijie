import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { solutionApi } from "../api";
import { exportSolutionMethodsDoc } from "../utils/wordExport";
import type { SolutionMethod } from "../types";

const domains = ["政治", "经济", "文化", "社会", "生态"];
const domainColors: Record<string, string> = {
  政治: "bg-rose-50 text-rose-700 border-rose-200",
  经济: "bg-amber-50 text-amber-700 border-amber-200",
  文化: "bg-violet-50 text-violet-700 border-violet-200",
  社会: "bg-sky-50 text-sky-700 border-sky-200",
  生态: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

interface Draft {
  heading: string;
  content: string;
  domain: string;
  tags: string;
}

export default function SolutionMethods() {
  const [list, setList] = useState<SolutionMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeDomain, setActiveDomain] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await solutionApi.list({ q: query, domain: activeDomain === "all" ? "" : activeDomain });
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [query, activeDomain]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const domainCounts: Record<string, number> = {};
  list.forEach((m) => {
    const d = m.domain || "未分类";
    domainCounts[d] = (domainCounts[d] || 0) + 1;
  });

  const startEdit = (m: SolutionMethod) => {
    setDraft({
      heading: m.heading || "",
      content: m.content || "",
      domain: m.domain || "政治",
      tags: (m.tags || []).join(", "),
    });
    setEditingId(m.id ?? null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async (m: SolutionMethod) => {
    if (m.id == null || !draft) return;
    setSavingId(m.id);
    try {
      await solutionApi.update(m.id, {
        heading: draft.heading,
        content: draft.content,
        domain: draft.domain,
        tags: draft.tags
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setEditingId(null);
      setDraft(null);
      await fetchData();
    } catch {
      alert("保存失败，请重试");
    } finally {
      setSavingId(null);
    }
  };

  const handleExport = () => {
    setExporting(true);
    try {
      exportSolutionMethodsDoc(list);
    } finally {
      setExporting(false);
    }
  };

  let filtered = list;
  if (activeDomain !== "all") {
    filtered = filtered.filter((m) => (m.domain || "未分类") === activeDomain);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 ink-title">解决方法库</h1>
          <p className="text-sm text-ink-500 mt-1">
            收藏自文章拆解的解决方法，按政治、经济、文化、社会、生态分类，可附加自定义标签
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || list.length === 0}
          className="btn-secondary whitespace-nowrap"
        >
          {exporting ? "导出中..." : "⬇ 导出 Word"}
        </button>
      </div>

      {/* Search bar */}
      <div className="card p-4 mb-5">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-field pl-11"
            placeholder="搜索解决方法内容、标签、来源文章..."
          />
        </div>
      </div>

      {/* Domain filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setActiveDomain("all")}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeDomain === "all" ? "bg-brand-700 text-white shadow-sm" : "bg-white text-ink-600 border border-ink-200 hover:bg-ink-50"
          }`}
        >
          全部 ({list.length})
        </button>
        {domains.map((domain) => (
          <button
            key={domain}
            onClick={() => setActiveDomain(domain)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeDomain === domain ? "bg-brand-700 text-white shadow-sm" : "bg-white text-ink-600 border border-ink-200 hover:bg-ink-50"
            }`}
          >
            {domain} ({domainCounts[domain] || 0})
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">💡</div>
          <h3 className="text-lg font-semibold text-ink-900 mb-2">
            {query || activeDomain !== "all" ? "没有匹配的方法" : "解决方法库还是空的"}
          </h3>
          <p className="text-sm text-ink-500 mb-4">
            {query || activeDomain !== "all" ? "试试其他关键词或领域" : "在「文章拆解」或「历史记录」中，将心仪的解决方法一键收藏到这里"}
          </p>
          {!query && activeDomain === "all" && (
            <Link to="/analyze" className="btn-primary inline-flex">去拆解文章</Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((m) => (
            <div key={m.id} className="card p-5 hover:border-brand-300 transition-colors border-l-4 border-brand-300">
              {editingId === m.id && draft ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-ink-500">方向标题</label>
                    <input
                      className="input-field w-full"
                      value={draft.heading}
                      onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">具体举措与预期效果</label>
                    <textarea
                      className="input-field w-full h-28"
                      value={draft.content}
                      onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-ink-500">领域</label>
                      <select
                        className="input-field w-full"
                        value={draft.domain}
                        onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
                      >
                        {domains.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-ink-500">标签（逗号分隔）</label>
                      <input
                        className="input-field w-full"
                        value={draft.tags}
                        onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={cancelEdit} className="btn-secondary text-sm">取消</button>
                    <button
                      onClick={() => saveEdit(m)}
                      disabled={savingId === m.id}
                      className="btn-primary text-sm"
                    >
                      {savingId === m.id ? "保存中…" : "保存"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <span className={`badge border ${domainColors[m.domain || ""] || "bg-ink-50 text-ink-700 border-ink-200"}`}>
                      {m.domain || "未分类"}
                    </span>
                    <div className="flex items-center gap-2">
                      {m.articleId && (
                        <Link to={`/articles/${m.articleId}`} className="text-xs text-brand-500 hover:text-brand-700 truncate">
                          {m.articleTitle} →
                        </Link>
                      )}
                      <button
                        onClick={() => startEdit(m)}
                        className="text-xs text-ink-400 hover:text-brand-600"
                        title="编辑并同步到历史记录"
                      >
                        编辑
                      </button>
                    </div>
                  </div>
                  {m.heading && (
                    <h3 className="text-sm font-semibold text-ink-900 mb-1.5">{m.heading}</h3>
                  )}
                  <p className="text-sm text-ink-800 mb-3 leading-relaxed font-serif whitespace-pre-wrap">
                    {m.content}
                  </p>
                  {m.tags && m.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {m.tags.map((tag, ti) => (
                        <span key={ti} className="tag">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="pt-2 border-t border-ink-100 flex items-center justify-between">
                    <span className="text-xs text-ink-400">
                      {new Date(m.createdAt || "").toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
