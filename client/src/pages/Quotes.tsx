import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { quotesApi } from "../api";
import { exportQuotesDoc } from "../utils/wordExport";

interface Quote {
  id: number;
  quote: string;
  source: string;
  articleId?: number | null;
  articleTitle?: string;
  tags: string[];
  createdAt: string;
}

export default function Quotes() {
  const [list, setList] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await quotesApi.list({ q: query, tag: activeTag });
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [query, activeTag]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const allTags = Array.from(new Set(list.flatMap((c) => c.tags || []))).sort();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 ink-title">金句库</h1>
          <p className="text-sm text-ink-500 mt-1">
            收藏的文章金句，标注来源与适用主题，方便写作时随时调取
          </p>
        </div>
        <button
          onClick={() => exportQuotesDoc(list)}
          disabled={list.length === 0}
          className="btn-secondary whitespace-nowrap"
        >
          ⬇ 导出 Word
        </button>
      </div>

      {/* Search */}
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
            placeholder="搜索金句内容、出处、来源文章..."
          />
        </div>
      </div>

      {/* Tag filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-xs text-ink-400">主题标签：</span>
        <button
          onClick={() => setActiveTag("")}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            activeTag === "" ? "bg-ink-700 text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100"
          }`}
        >
          全部
        </button>
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag === activeTag ? "" : tag)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTag === tag ? "bg-ink-700 text-white" : "bg-ink-50 text-ink-600 hover:bg-ink-100"
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">💎</div>
          <h3 className="text-lg font-semibold text-ink-900 mb-2">
            {query || activeTag ? "没有匹配的金句" : "金句库还是空的"}
          </h3>
          <p className="text-sm text-ink-500 mb-4">
            {query || activeTag ? "试试其他关键词或标签" : "在「文章拆解」或「历史记录」中，将心仪金句一键收藏到这里"}
          </p>
          {!query && !activeTag && <Link to="/analyze" className="btn-primary inline-flex">去拆解文章</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {list.map((item) => (
            <div key={item.id} className="card p-5 hover:border-brand-300 transition-colors border-l-4 border-brand-300">
              <blockquote className="text-sm font-serif text-ink-900 leading-relaxed">
                {item.quote}
              </blockquote>
              {item.source && (
                <p className="text-xs text-ink-400 mt-2">—— {item.source}</p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-100 gap-2 flex-wrap">
                {item.articleId ? (
                  <Link to={`/articles/${item.articleId}`} className="text-xs text-brand-500 hover:text-brand-700 truncate">
                    来源：{item.articleTitle || "未知文章"} →
                  </Link>
                ) : (
                  <span className="text-xs text-ink-400">来源：未关联文章</span>
                )}
                <span className="text-xs text-ink-400 shrink-0">
                  {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
              {item.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {item.tags.map((tag, ti) => (
                    <span key={ti} className="tag">#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
