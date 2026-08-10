import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { materialApi } from "../api";
import { exportMaterialsDoc } from "../utils/wordExport";
import type { MaterialCase } from "../types";

const caseTypeColors: Record<string, string> = {
  "政策类": "bg-brand-50 text-brand-700 border-brand-200",
  "案例类": "bg-green-50 text-green-700 border-green-200",
  "数据类": "bg-amber-50 text-amber-700 border-amber-200",
  "金句类": "bg-purple-50 text-purple-700 border-purple-200",
  "理论类": "bg-seal-50 text-seal-700 border-seal-200",
};

const domains = ["政治", "经济", "文化", "社会", "生态"];
const domainColors: Record<string, string> = {
  政治: "bg-rose-50 text-rose-700 border-rose-200",
  经济: "bg-amber-50 text-amber-700 border-amber-200",
  文化: "bg-violet-50 text-violet-700 border-violet-200",
  社会: "bg-sky-50 text-sky-700 border-sky-200",
  生态: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

interface Draft {
  summary: string;
  type: string;
  domain: string;
  tags: string;
  usageScenario: string;
}

export default function Materials() {
  const [cards, setCards] = useState<MaterialCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeDomain, setActiveDomain] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await materialApi.search(query);
      setCards(data);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const startEdit = (c: MaterialCase) => {
    setDraft({
      summary: c.summary || "",
      type: c.type || "",
      domain: c.domain || "",
      tags: (c.tags || []).join(", "),
      usageScenario: c.usageScenario || "",
    });
    setEditingId(c.cardId!);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async (c: MaterialCase) => {
    if (!c.articleId || !draft) return;
    setSavingId(c.cardId!);
    try {
      await materialApi.update(c.articleId, c.linkId!, {
        summary: draft.summary,
        type: draft.type,
        domain: draft.domain,
        tags: draft.tags
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
        usageScenario: draft.usageScenario,
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

  const domainCounts: Record<string, number> = {};
  cards.forEach((c) => {
    const d = c.domain || "未分类";
    domainCounts[d] = (domainCounts[d] || 0) + 1;
  });

  let filtered = cards;
  if (activeDomain !== "all") {
    filtered = filtered.filter((c) => (c.domain || "未分类") === activeDomain);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 ink-title">素材案例库</h1>
          <p className="text-sm text-ink-500 mt-1">
            按政治、经济、文化、社会、生态五大领域分类，搜索和浏览所有素材
          </p>
        </div>
        <button
          onClick={() => exportMaterialsDoc(cards)}
          disabled={cards.length === 0}
          className="btn-secondary whitespace-nowrap"
        >
          ⬇ 导出 Word
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
            placeholder="搜索素材内容、标签、关键词..."
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
          全部 ({cards.length})
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
          <div className="text-4xl mb-4">🗂️</div>
          <h3 className="text-lg font-semibold text-ink-900 mb-2">
            {cards.length === 0 ? "还没有素材案例" : "该领域暂无素材案例"}
          </h3>
          <p className="text-sm text-ink-500 mb-4">
            {cards.length === 0 ? "拆解文章后，素材案例会自动按领域收录到这里" : "试试其他领域或关键词"}
          </p>
          {cards.length === 0 && <Link to="/analyze" className="btn-primary inline-flex">去拆解文章</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((card) => (
            <div key={card.cardId} className="card p-5 hover:border-brand-300 transition-colors">
              {editingId === card.cardId && draft ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-ink-500">内容摘要</label>
                    <textarea
                      className="input-field w-full h-24"
                      value={draft.summary}
                      onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-ink-500">类型</label>
                      <select
                        className="input-field w-full"
                        value={draft.type}
                        onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                      >
                        {Object.keys(caseTypeColors).map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
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
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">标签（逗号分隔）</label>
                    <input
                      className="input-field w-full"
                      value={draft.tags}
                      onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500">适用场景</label>
                    <input
                      className="input-field w-full"
                      value={draft.usageScenario}
                      onChange={(e) => setDraft({ ...draft, usageScenario: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={cancelEdit} className="btn-secondary text-sm">取消</button>
                    <button
                      onClick={() => saveEdit(card)}
                      disabled={savingId === card.cardId}
                      className="btn-primary text-sm"
                    >
                      {savingId === card.cardId ? "保存中…" : "保存"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`badge border ${domainColors[card.domain || ""] || "bg-ink-50 text-ink-700 border-ink-200"}`}>
                        {card.domain || "未分类"}
                      </span>
                      <span className={`badge border ${caseTypeColors[card.type] || "bg-ink-50 text-ink-700 border-ink-200"}`}>
                        {card.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {card.articleId && (
                        <Link to={`/articles/${card.articleId}`} className="text-xs text-brand-500 hover:text-brand-700">
                          {card.articleTitle} →
                        </Link>
                      )}
                      <button
                        onClick={() => startEdit(card)}
                        className="text-xs text-ink-400 hover:text-brand-600"
                        title="编辑并同步到历史记录"
                      >
                        编辑
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-ink-800 mb-3 leading-relaxed font-serif">{card.summary}</p>
                  {card.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {card.tags.map((tag, ti) => (<span key={ti} className="tag">#{tag}</span>))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-3 border-t border-ink-100">
                    <span className="text-xs text-ink-400">适用场景：{card.usageScenario}</span>
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
