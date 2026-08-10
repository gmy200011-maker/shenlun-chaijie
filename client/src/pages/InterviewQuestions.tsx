import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { interviewApi } from "../api";
import { exportInterviewsDoc } from "../utils/wordExport";

interface InterviewQuestion {
  id: number;
  question: string;
  type: string;
  answerIdea: string;
  articleId?: number;
  articleTitle?: string;
  createdAt: string;
}

const types = ["综合分析", "应急应变", "组织管理", "人际关系", "情景模拟", "自我认知"];

const typeColors: Record<string, string> = {
  综合分析: "bg-brand-50 text-brand-700 border-brand-200",
  应急应变: "bg-amber-50 text-amber-700 border-amber-200",
  组织管理: "bg-green-50 text-green-700 border-green-200",
  人际关系: "bg-sky-50 text-sky-700 border-sky-200",
  情景模拟: "bg-violet-50 text-violet-700 border-violet-200",
  自我认知: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function InterviewQuestions() {
  const [list, setList] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await interviewApi.list({ q: query, type: activeType });
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [query, activeType]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 ink-title">面试题目库</h1>
          <p className="text-sm text-ink-500 mt-1">
            每篇拆解自动生成一道公务员面试模拟题与参考思路，可按题型检索
          </p>
        </div>
        <button
          onClick={() => exportInterviewsDoc(list)}
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
            placeholder="搜索面试题干、答题思路、来源文章..."
          />
        </div>
      </div>

      {/* Type filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setActiveType("")}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeType === "" ? "bg-brand-700 text-white shadow-sm" : "bg-white text-ink-600 border border-ink-200 hover:bg-ink-50"
          }`}
        >
          全部 ({list.length})
        </button>
        {types.map((t) => {
          const count = list.filter((i) => i.type === t).length;
          if (activeType !== "" && activeType !== t && count === 0) return null;
          return (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeType === t ? "bg-brand-700 text-white shadow-sm" : "bg-white text-ink-600 border border-ink-200 hover:bg-ink-50"
              }`}
            >
              {t} ({count})
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-lg font-semibold text-ink-900 mb-2">
            {query || activeType ? "没有匹配的面试题目" : "还没有面试题目"}
          </h3>
          <p className="text-sm text-ink-500 mb-4">
            {query || activeType ? "试试其他关键词或题型" : "拆解文章后，系统会自动生成并收录面试题目"}
          </p>
          {!query && !activeType && <Link to="/analyze" className="btn-primary inline-flex">去拆解文章</Link>}
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((item) => (
            <div key={item.id} className="card p-6 hover:border-brand-300 transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">🎯</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`badge border ${typeColors[item.type] || "bg-ink-50 text-ink-700 border-ink-200"}`}>
                      {item.type}
                    </span>
                    {item.articleId && (
                      <Link
                        to={`/articles/${item.articleId}`}
                        className="text-xs text-brand-500 hover:text-brand-700"
                      >
                        来源：{item.articleTitle || "未知文章"} →
                      </Link>
                    )}
                    <span className="text-xs text-ink-400 ml-auto">
                      {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-ink-900 leading-relaxed mb-3 font-serif">
                    {item.question}
                  </h3>
                  <div className="bg-ink-50/60 rounded-lg p-4">
                    <div className="text-xs font-semibold text-ink-500 mb-2">参考回答思路</div>
                    <p className="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap font-serif">
                      {item.answerIdea}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
