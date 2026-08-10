import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { articleApi } from "../api";
import type { Article } from "../types";

export default function Articles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    articleApi.list().then(setArticles).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 ink-title">历史记录</h1>
          <p className="text-sm text-ink-500 mt-1">所有拆解过的文章（共 {articles.length} 篇）</p>
        </div>
        <Link to="/analyze" className="btn-primary">+ 拆解新文章</Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : articles.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-ink-900 mb-2">还没有拆解记录</h3>
          <p className="text-sm text-ink-500 mb-4">粘贴浙江宣传文章全文，开始你的申论素材积累之旅</p>
          <Link to="/analyze" className="btn-primary inline-flex">开始拆解</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => {
            const cases = article.materialCases || [];
            return (
              <Link
                key={article.id}
                to={`/articles/${article.id}`}
                className="card p-5 flex items-center gap-4 hover:border-brand-300 transition-colors group"
              >
                <div className="w-12 h-12 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-lg font-bold shrink-0">
                  {article.id}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-ink-900 group-hover:text-brand-700 truncate">
                    {article.title}
                  </h3>
                  {article.background && (
                    <p className="text-sm text-ink-500 truncate mt-0.5">{article.background}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-ink-400">{new Date(article.createdAt).toLocaleString("zh-CN")}</span>
                    {cases.length > 0 && <span className="text-xs text-ink-400">{cases.length} 个素材案例</span>}
                    {article.goldenQuotes?.length > 0 && <span className="text-xs text-ink-400">{article.goldenQuotes.length} 条金句</span>}
                  </div>
                </div>
                <svg className="w-5 h-5 text-ink-300 group-hover:text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
