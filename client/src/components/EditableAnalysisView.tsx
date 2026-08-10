import { useState } from "react";
import AutoTextarea from "./AutoTextarea";
import type {
  AnalysisResult,
  GoldenQuote,
  MaterialCase,
  AnalysisPoint,
} from "../types";

const cardTypeColors: Record<string, string> = {
  政策类: "bg-brand-50 text-brand-700 border-brand-200",
  案例类: "bg-green-50 text-green-700 border-green-200",
  数据类: "bg-amber-50 text-amber-700 border-amber-200",
  金句类: "bg-purple-50 text-purple-700 border-purple-200",
  理论类: "bg-seal-50 text-seal-700 border-seal-200",
};

const cardTypes = ["政策类", "案例类", "数据类", "金句类", "理论类"];
const domains = ["政治", "经济", "文化", "社会", "生态"];
const domainColors: Record<string, string> = {
  政治: "bg-rose-50 text-rose-700 border-rose-200",
  经济: "bg-amber-50 text-amber-700 border-amber-200",
  文化: "bg-violet-50 text-violet-700 border-violet-200",
  社会: "bg-sky-50 text-sky-700 border-sky-200",
  生态: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

interface Props {
  result: AnalysisResult;
  onChange?: (patch: Partial<AnalysisResult>) => void;
  editable?: boolean;
  savedQuotes?: Set<number>;
  onSaveQuote?: (q: GoldenQuote, i: number) => void;
  savedSolutions?: Set<number>;
  onSaveSolution?: (
    p: AnalysisPoint,
    domain: string,
    tags: string[],
    i: number
  ) => void;
}

export default function EditableAnalysisView({
  result,
  onChange,
  editable = true,
  savedQuotes,
  onSaveQuote,
  savedSolutions,
  onSaveSolution,
}: Props) {
  const [solutionDomains, setSolutionDomains] = useState<Record<number, string>>({});
  const [solutionTags, setSolutionTags] = useState<Record<number, string>>({});

  const setPatch = (patch: Partial<AnalysisResult>) => {
    if (editable && onChange) onChange(patch);
  };

  // ===== AnalysisPoints helpers =====
  const updatePoint = (
    key: "phenomenonAnalysis" | "solutions",
    i: number,
    patch: Partial<AnalysisPoint>
  ) => {
    const next = (result[key] || []).map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    setPatch({ [key]: next });
  };
  const addPoint = (key: "phenomenonAnalysis" | "solutions") => {
    setPatch({ [key]: [...(result[key] || []), { heading: "", content: "" }] });
  };
  const removePoint = (key: "phenomenonAnalysis" | "solutions", i: number) => {
    setPatch({ [key]: (result[key] || []).filter((_, idx) => idx !== i) });
  };

  // ===== Golden Quotes helpers =====
  const updateQuote = (i: number, patch: Partial<GoldenQuote>) => {
    const next = [...(result.goldenQuotes || [])];
    next[i] = { ...next[i], ...patch };
    setPatch({ goldenQuotes: next });
  };
  const addQuote = () => {
    if ((result.goldenQuotes || []).length >= 5) return;
    setPatch({
      goldenQuotes: [...(result.goldenQuotes || []), { quote: "", source: "" }],
    });
  };
  const removeQuote = (i: number) => {
    setPatch({
      goldenQuotes: (result.goldenQuotes || []).filter((_, idx) => idx !== i),
    });
  };

  // ===== Material Cases helpers =====
  const updateCase = (i: number, patch: Partial<MaterialCase>) => {
    const next = [...(result.materialCases || [])];
    next[i] = { ...next[i], ...patch };
    setPatch({ materialCases: next });
  };
  const addCase = () => {
    if ((result.materialCases || []).length >= 5) return;
    setPatch({
      materialCases: [
        ...(result.materialCases || []),
        { type: "政策类", domain: "政治", summary: "", tags: [], usageScenario: "申论大作文" },
      ],
    });
  };
  const removeCase = (i: number) => {
    setPatch({
      materialCases: (result.materialCases || []).filter((_, idx) => idx !== i),
    });
  };

  // ===== Render phenomenon / solution points (text only, no collect UI) =====
  const renderPoints = (key: "phenomenonAnalysis", icon: string, label: string) => (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xl">{icon}</span>
        <h3 className="text-sm font-semibold text-ink-500 ink-title">{label}</h3>
        <span className="text-xs text-ink-400">{(result[key] || []).length} 个层次</span>
      </div>
      <div className="space-y-4">
        {(result[key] || []).map((p, i) => (
          <div key={i} className="border-l-4 border-brand-200 pl-4">
            {p.heading && (
              <h4 className="text-sm font-semibold text-ink-800 mb-1.5">{p.heading}</h4>
            )}
            <p className="text-sm font-serif text-ink-800 leading-relaxed whitespace-pre-wrap">
              {p.content}
            </p>
          </div>
        ))}
        {(result[key] || []).length === 0 && (
          <p className="text-sm text-ink-400 pl-2">暂无内容</p>
        )}
      </div>
    </div>
  );

  // ===== Render 解决方法 with collect-to-library UI =====
  const renderSolutions = () => (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">💡</span>
          <h3 className="text-sm font-semibold text-ink-500 ink-title">解决方法</h3>
          <span className="text-xs text-ink-400">{(result.solutions || []).length} 条</span>
        </div>
        {editable && (
          <button onClick={() => addPoint("solutions")} className="btn-add">+ 添加</button>
        )}
      </div>
      <div className="space-y-4">
        {(result.solutions || []).map((p, i) => {
          const saved = savedSolutions?.has(i);
          const domain = solutionDomains[i] || "政治";
          return (
            <div key={i} className="border border-ink-200/60 rounded-lg p-4 group relative">
              {editable && (
                <button
                  onClick={() => removePoint("solutions", i)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-ink-300 hover:text-seal-500 transition-all"
                  title="删除"
                >
                  ✕
                </button>
              )}
              {editable ? (
                <input
                  value={p.heading}
                  onChange={(e) => updatePoint("solutions", i, { heading: e.target.value })}
                  className="input-field text-sm font-semibold mb-2"
                  placeholder="对策方向（如：制度建设/技术赋能/理念转变）"
                />
              ) : (
                p.heading && (
                  <h4 className="text-sm font-semibold text-ink-800 mb-1.5">{p.heading}</h4>
                )
              )}
              {editable ? (
                <AutoTextarea
                  value={p.content}
                  onChange={(e) => updatePoint("solutions", i, { content: e.target.value })}
                  className="input-field text-sm min-h-[90px] font-serif leading-relaxed"
                  placeholder="具体举措与预期效果，条理清晰、可操作..."
                />
              ) : (
                <p className="text-sm font-serif text-ink-800 leading-relaxed whitespace-pre-wrap">
                  {p.content}
                </p>
              )}

              {/* Collect-to-解决方法库 toolbar */}
              <div className="mt-3 pt-3 border-t border-ink-100 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-ink-400">收藏到库：</span>
                <select
                  value={domain}
                  onChange={(e) =>
                    setSolutionDomains((prev) => ({ ...prev, [i]: e.target.value }))
                  }
                  className={`text-xs font-medium rounded-md px-2 py-1 border-0 outline-none cursor-pointer ${
                    domainColors[domain] || "bg-ink-50 text-ink-700 border-ink-200"
                  }`}
                >
                  {domains.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={solutionTags[i] || ""}
                  onChange={(e) =>
                    setSolutionTags((prev) => ({ ...prev, [i]: e.target.value }))
                  }
                  className="input-field text-xs flex-1 min-w-[120px]"
                  placeholder="自定义标签（逗号分隔，可选）"
                />
                <button
                  onClick={() => {
                    const tags = (solutionTags[i] || "")
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    onSaveSolution?.(p, domain, tags, i);
                  }}
                  disabled={!p.content.trim() || saved}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap ${
                    saved
                      ? "bg-green-50 text-green-600 border-green-200"
                      : "bg-white text-brand-600 border-brand-200 hover:bg-brand-50"
                  }`}
                >
                  {saved ? "✓ 已收藏" : "收藏到解决方法库"}
                </button>
              </div>
            </div>
          );
        })}
        {(result.solutions || []).length === 0 && (
          <p className="text-sm text-ink-400 pl-2">暂无内容，点击「添加」</p>
        )}
      </div>
    </div>
  );

  // ===== Material cases (read-only card when !editable) =====
  const renderMaterialCard = (card: MaterialCase, i: number) => (
    <div key={i} className="border border-ink-200/60 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`badge border ${domainColors[card.domain || ""] || "bg-ink-50 text-ink-700 border-ink-200"}`}>
          {card.domain || "未分类"}
        </span>
        <span className={`badge border ${cardTypeColors[card.type] || "bg-ink-50 text-ink-700 border-ink-200"}`}>
          {card.type}
        </span>
      </div>
      <p className="text-sm text-ink-800 mb-2 font-serif leading-relaxed">{card.summary}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {card.tags?.map((tag, ti) => (
          <span key={ti} className="tag">#{tag}</span>
        ))}
      </div>
      <p className="text-xs text-ink-400">适用场景：{card.usageScenario}</p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* 写作背景 */}
      <div className="card p-6">
        <div className="flex items-start gap-3">
          <span className="text-xl">📜</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ink-500 mb-2 ink-title">写作背景</h3>
            {editable ? (
              <AutoTextarea
                value={result.background || ""}
                onChange={(e) => setPatch({ background: e.target.value })}
                className="input-field text-sm min-h-[80px] font-serif leading-relaxed"
                placeholder="文章写作的时代背景、社会背景或政策背景..."
              />
            ) : (
              <p className="text-sm font-serif text-ink-800 leading-relaxed whitespace-pre-wrap">
                {result.background}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 现象剖析 */}
      {renderPoints("phenomenonAnalysis", "🔍", "现象剖析")}

      {/* 解决方法 */}
      {renderSolutions()}

      {/* 面试题目 (display only) */}
      {result.interviewQuestion && result.interviewQuestion.question && (
        <div className="card p-6 border-l-4 border-brand-400">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">🎯</span>
            <h3 className="text-sm font-semibold text-ink-500 ink-title">面试模拟题</h3>
            <span className="badge bg-brand-50 text-brand-700 border border-brand-200">
              {result.interviewQuestion.type}
            </span>
          </div>
          <p className="text-sm font-medium text-ink-900 leading-relaxed mb-3 font-serif">
            {result.interviewQuestion.question}
          </p>
          <div className="bg-ink-50/60 rounded-lg p-4">
            <div className="text-xs font-semibold text-ink-500 mb-2">参考回答思路</div>
            <p className="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap font-serif">
              {result.interviewQuestion.answerIdea}
            </p>
          </div>
        </div>
      )}

      {/* 文章金句 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">💎</span>
            <h3 className="text-sm font-semibold text-ink-500 ink-title">文章金句</h3>
            <span className="text-xs text-ink-400">{(result.goldenQuotes || []).length}/5</span>
          </div>
          {editable && (result.goldenQuotes || []).length < 5 && (
            <button onClick={addQuote} className="btn-add">+ 添加</button>
          )}
        </div>
        <div className="space-y-3">
          {(result.goldenQuotes || []).map((q, i) => {
            const saved = savedQuotes?.has(i);
            return (
              <div
                key={i}
                className="border-l-4 border-brand-300 bg-brand-50/30 px-4 py-3 rounded-r-lg group relative"
              >
                {editable && (
                  <button
                    onClick={() => removeQuote(i)}
                    className="absolute top-2 right-3 opacity-0 group-hover:opacity-100 text-ink-300 hover:text-seal-500 transition-all"
                    title="删除"
                  >
                    ✕
                  </button>
                )}
                {editable ? (
                  <>
                    <AutoTextarea
                      value={q.quote}
                      onChange={(e) => updateQuote(i, { quote: e.target.value })}
                      className="w-full bg-transparent text-sm font-serif text-ink-900 leading-relaxed outline-none min-h-[40px]"
                      placeholder="金句原文..."
                    />
                    <input
                      type="text"
                      value={q.source}
                      onChange={(e) => updateQuote(i, { source: e.target.value })}
                      className="w-full bg-transparent text-xs text-ink-400 outline-none mt-1"
                      placeholder="出处/位置"
                    />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-serif text-ink-900 leading-relaxed">{q.quote}</p>
                    {q.source && <p className="text-xs text-ink-400 mt-1.5">—— {q.source}</p>}
                  </>
                )}
                {onSaveQuote && (
                  <button
                    onClick={() => onSaveQuote(q, i)}
                    disabled={!q.quote.trim() || saved}
                    className={`mt-2 text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      saved
                        ? "bg-green-50 text-green-600 border-green-200"
                        : "bg-white text-brand-600 border-brand-200 hover:bg-brand-50"
                    }`}
                  >
                    {saved ? "✓ 已收藏到金句库" : "收藏到金句库"}
                  </button>
                )}
              </div>
            );
          })}
          {(result.goldenQuotes || []).length === 0 && (
            <p className="text-sm text-ink-400 pl-2">暂无金句</p>
          )}
        </div>
      </div>

      {/* 素材案例 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🗂️</span>
            <h3 className="text-sm font-semibold text-ink-500 ink-title">素材案例</h3>
            <span className="text-xs text-ink-400">{(result.materialCases || []).length}/5</span>
          </div>
          {editable && (result.materialCases || []).length < 5 && (
            <button onClick={addCase} className="btn-add">+ 添加</button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {(result.materialCases || []).map((card, i) =>
            editable ? (
              <div
                key={i}
                className="border border-ink-200/60 rounded-lg p-4 group relative"
              >
                <button
                  onClick={() => removeCase(i)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-ink-300 hover:text-seal-500 transition-all"
                  title="删除"
                >
                  ✕
                </button>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <select
                    value={card.type}
                    onChange={(e) => updateCase(i, { type: e.target.value })}
                    className={`text-xs font-medium rounded-md px-2 py-1 border-0 outline-none cursor-pointer ${
                      cardTypeColors[card.type] || "bg-ink-50 text-ink-700 border-ink-200"
                    }`}
                  >
                    {cardTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    value={card.domain || "政治"}
                    onChange={(e) => updateCase(i, { domain: e.target.value })}
                    className={`text-xs font-medium rounded-md px-2 py-1 border-0 outline-none cursor-pointer ${
                      domainColors[card.domain || "政治"] || "bg-ink-50 text-ink-700 border-ink-200"
                    }`}
                  >
                    {domains.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <AutoTextarea
                  value={card.summary}
                  onChange={(e) => updateCase(i, { summary: e.target.value })}
                  className="input-field text-sm min-h-[60px]"
                  placeholder="素材内容摘要..."
                />
                <div>
                  <label className="block text-xs text-ink-400 mb-1">标签（逗号分隔）</label>
                  <input
                    type="text"
                    value={(card.tags || []).join(", ")}
                    onChange={(e) =>
                      updateCase(i, {
                        tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                      })
                    }
                    className="input-field text-xs"
                    placeholder="乡村振兴, 数字经济"
                  />
                </div>
                <input
                  type="text"
                  value={card.usageScenario}
                  onChange={(e) => updateCase(i, { usageScenario: e.target.value })}
                  className="input-field text-xs mt-2"
                  placeholder="适用场景：申论大作文/面试综合分析"
                />
              </div>
            ) : (
              renderMaterialCard(card, i)
            )
          )}
          {(result.materialCases || []).length === 0 && (
            <p className="text-sm text-ink-400 pl-2 col-span-2">暂无素材案例</p>
          )}
        </div>
      </div>
    </div>
  );
}
