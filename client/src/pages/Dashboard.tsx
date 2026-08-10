import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { statsApi } from "../api";
import type { Stats } from "../types";

const domainColors: Record<string, string> = {
  政治: "bg-rose-100 text-rose-700",
  经济: "bg-amber-100 text-amber-700",
  文化: "bg-violet-100 text-violet-700",
  社会: "bg-sky-100 text-sky-700",
  生态: "bg-emerald-100 text-emerald-700",
  未分类: "bg-ink-100 text-ink-600",
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi
      .get()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <div className="p-8 text-center text-ink-500">加载失败，请刷新重试</div>;
  }

  const statCards = [
    { label: "已拆解文章", value: stats.totalArticles, icon: "📄", color: "bg-brand-50 text-brand-700", to: "/articles" },
    { label: "素材案例", value: stats.totalCases, icon: "🗂️", color: "bg-green-50 text-green-700", to: "/materials" },
    { label: "面试题目", value: stats.totalInterviews, icon: "🎯", color: "bg-sky-50 text-sky-700", to: "/interview" },
    { label: "金句收藏", value: stats.totalQuotes, icon: "💎", color: "bg-amber-50 text-amber-700", to: "/quotes" },
    { label: "解决方法", value: stats.totalSolutions, icon: "💡", color: "bg-violet-50 text-violet-700", to: "/solutions" },
  ];

  const domainDist = stats.casesByDomain || {};

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink-900 ink-title">数据看板</h1>
        <p className="text-sm text-ink-500 mt-1">你的申论与面试素材积累进度一览</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-5 mb-8">
        {statCards.map((card) => (
          <Link key={card.label} to={card.to} className="card p-6 hover:border-brand-300 transition-colors block">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-ink-500">{card.label}</span>
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${card.color}`}>
                {card.icon}
              </span>
            </div>
            <div className="text-3xl font-bold text-ink-900">{card.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Domain distribution */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-ink-900 mb-4 ink-title">素材领域分布</h2>
          {stats.totalCases === 0 ? (
            <p className="text-sm text-ink-400 py-8 text-center">暂无素材，去拆解第一篇文章吧</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(domainDist).map(([domain, count]) => {
                const pct = ((count / stats.totalCases) * 100).toFixed(0);
                return (
                  <div key={domain}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`badge ${domainColors[domain] || "bg-ink-100 text-ink-600"} border border-transparent`}>
                        {domain}
                      </span>
                      <span className="text-sm text-ink-500">{count} 个 ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent articles */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-ink-900 ink-title">最近拆解</h2>
            <Link to="/articles" className="text-sm text-brand-600 hover:text-brand-700">查看全部 →</Link>
          </div>
          {stats.recentArticles.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-ink-400 mb-3">还没有拆解记录</p>
              <Link to="/analyze" className="btn-primary text-sm">开始拆解第一篇</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentArticles.map((article) => (
                <Link
                  key={article.id}
                  to={`/articles/${article.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-ink-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-sm font-medium shrink-0">
                    {article.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate">{article.title}</div>
                    {article.background && (
                      <div className="text-xs text-ink-400 truncate mt-0.5">{article.background}</div>
                    )}
                  </div>
                  <span className="text-xs text-ink-400 shrink-0">
                    {new Date(article.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
