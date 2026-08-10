import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { noteApi, articleApi } from "../api";
import type { Note, Article, AnalysisResult, AnalysisPoint } from "../types";
import EditableAnalysisView from "../components/EditableAnalysisView";
import { exportNotesDoc } from "../utils/wordExport";

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32];

interface TocItem {
  index: number;
  level: number;
  text: string;
}

interface Tab {
  tabId: string;
  id?: number;
  title: string;
  content: string;
  dirty: boolean;
  updatedAt?: string;
}

// 将文章拆解结果整理成 AnalysisResult（与 ArticleDetail 保持一致）
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

export default function Notes() {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const tabSeq = useRef(1);

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [toc, setToc] = useState<TocItem[]>([]);
  const [isEmpty, setIsEmpty] = useState(true);

  const [notes, setNotes] = useState<Note[]>([]); // 全部笔记（用于「打开笔记」选择）
  const [articles, setArticles] = useState<Article[]>([]); // 文章拆解历史（右侧栏）

  const [showHistory, setShowHistory] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loadingArticle, setLoadingArticle] = useState(false);

  const [showNotePicker, setShowNotePicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage(null), 1800);
  }, []);

  const newBlankTab = useCallback((): Tab => {
    const id = "tab-" + tabSeq.current++;
    return { tabId: id, title: "", content: "", dirty: false };
  }, []);

  // 初始化：打开一个空白笔记页
  useEffect(() => {
    const t = newBlankTab();
    setTabs([t]);
    setActiveTabId(t.tabId);
  }, [newBlankTab]);

  const activeTab = tabs.find((t) => t.tabId === activeTabId) || null;

  const rebuildToc = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const headings = Array.from(editor.querySelectorAll("h1,h2,h3"));
    setToc(
      headings.map((h, i) => ({
        index: i,
        level: Number((h.tagName || "H1")[1]) || 1,
        text: (h.textContent || "").trim() || `(无标题 ${i + 1})`,
      }))
    );
  }, []);

  // 切换活动标签时，把对应内容载入编辑器
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const tab = tabs.find((t) => t.tabId === activeTabId);
    if (tab) {
      editor.innerHTML = tab.content || "";
      setTitle(tab.title);
      rebuildToc();
      setIsEmpty((tab.content || "").replace(/<[^>]*>/g, "").trim() === "");
    } else {
      editor.innerHTML = "";
      setTitle("");
      setToc([]);
      setIsEmpty(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  const onEditorInput = useCallback(() => {
    rebuildToc();
    const ed = editorRef.current;
    const html = ed ? ed.innerHTML : "";
    setIsEmpty(!ed || (ed.textContent || "").trim() === "");
    setTabs((prev) =>
      prev.map((t) => (t.tabId === activeTabId ? { ...t, content: html, dirty: true } : t))
    );
  }, [rebuildToc, activeTabId]);

  const onTitleChange = (v: string) => {
    setTitle(v);
    setTabs((prev) =>
      prev.map((t) => (t.tabId === activeTabId ? { ...t, title: v, dirty: true } : t))
    );
  };

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  // ===== Toolbar commands =====
  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    try {
      document.execCommand(cmd, false, val);
    } catch {
      /* ignore */
    }
    onEditorInput();
  };

  const formatBlock = (tag: string) => {
    editorRef.current?.focus();
    try {
      document.execCommand("formatBlock", false, tag);
    } catch {
      try {
        document.execCommand("formatBlock", false, `<${tag.toLowerCase()}>`);
      } catch {
        /* ignore */
      }
    }
    onEditorInput();
  };

  const applyFontSize = (px: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    let range = savedRangeRef.current;
    const sel = window.getSelection();
    if (!range && sel && sel.rangeCount) range = sel.getRangeAt(0);
    if (!range) return;
    const size = `${px}px`;
    editor.focus();
    if (!range.collapsed) {
      const r = range.cloneRange();
      const span = document.createElement("span");
      span.style.fontSize = size;
      try {
        span.appendChild(r.extractContents());
        r.insertNode(span);
        const nr = document.createRange();
        nr.selectNodeContents(span);
        sel?.removeAllRanges();
        sel?.addRange(nr);
      } catch {
        /* ignore */
      }
    } else {
      let node: any = range.startContainer;
      if (node.nodeType === 3) node = node.parentNode;
      while (node && node !== editor && getComputedStyle(node).display === "inline") {
        node = node.parentNode;
      }
      if (node && node !== editor) node.style.fontSize = size;
    }
    onEditorInput();
  };

  const jumpTo = (index: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const headings = editor.querySelectorAll("h1,h2,h3");
    const el = headings[index];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ===== Data =====
  const refreshNotes = useCallback(async () => {
    try {
      setNotes(await noteApi.list());
    } catch {
      setNotes([]);
    }
  }, []);

  const refreshArticles = useCallback(async () => {
    try {
      setArticles(await articleApi.list());
    } catch {
      setArticles([]);
    }
  }, []);

  useEffect(() => {
    Promise.all([refreshNotes(), refreshArticles()]).finally(() => setLoading(false));
  }, [refreshNotes, refreshArticles]);

  const deriveTitle = (html: string): string => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const h = tmp.querySelector("h1,h2,h3");
    if (h && (h.textContent || "").trim()) return (h.textContent || "").trim();
    const text = (tmp.textContent || "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, 30) : "未命名笔记";
  };

  const handleSave = async () => {
    const tab = tabs.find((t) => t.tabId === activeTabId);
    if (!tab) return;
    const editor = editorRef.current;
    if (!editor) return;
    const content = editor.innerHTML;
    const t = title.trim() || deriveTitle(content);
    setSaving(true);
    try {
      let saved: Note;
      if (tab.id != null) {
        const r = await noteApi.update(tab.id, { title: t, content });
        saved = r.note;
      } else {
        const r = await noteApi.create({ title: t, content });
        saved = r.note;
      }
      setTabs((prev) =>
        prev.map((x) =>
          x.tabId === tab.tabId
            ? { ...x, id: saved.id, title: saved.title, content: saved.content, dirty: false, updatedAt: saved.updatedAt }
            : x
        )
      );
      setTitle(saved.title);
      await refreshNotes();
      flash("已保存");
    } catch {
      flash("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleNewTab = () => {
    const t = newBlankTab();
    setTabs((prev) => [...prev, t]);
    setActiveTabId(t.tabId);
    setTimeout(() => editorRef.current?.focus(), 0);
  };

  const openNoteTab = (note: Note) => {
    const existing = tabs.find((t) => t.id != null && t.id === note.id);
    if (existing) {
      setActiveTabId(existing.tabId);
      setShowNotePicker(false);
      return;
    }
    const t: Tab = {
      tabId: "tab-" + tabSeq.current++,
      id: note.id,
      title: note.title,
      content: note.content,
      dirty: false,
      updatedAt: note.updatedAt,
    };
    setTabs((prev) => [...prev, t]);
    setActiveTabId(t.tabId);
    setShowNotePicker(false);
  };

  const closeTab = (tabId: string) => {
    const idx = tabs.findIndex((t) => t.tabId === tabId);
    const tab = tabs[idx];
    if (!tab) return;
    if (tab.dirty && !window.confirm("该笔记尚未保存，确定关闭吗？")) return;
    const next = tabs.filter((t) => t.tabId !== tabId);
    let target = next[Math.max(0, idx - 1)] || next[0];
    if (!target) {
      const nt = newBlankTab();
      setTabs([nt]);
      setActiveTabId(nt.tabId);
      return;
    }
    setTabs(next);
    setActiveTabId(target.tabId);
  };

  const handleDeleteNote = async (id: number) => {
    if (!window.confirm("确定删除这条笔记吗？此操作不可恢复。")) return;
    try {
      await noteApi.delete(id);
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (next.length === 0) {
          const nt = newBlankTab();
          setActiveTabId(nt.tabId);
          return [nt];
        }
        if (activeTabId && !next.find((t) => t.tabId === activeTabId)) {
          setActiveTabId(next[0].tabId);
        }
        return next;
      });
      await refreshNotes();
      flash("已删除");
    } catch {
      flash("删除失败");
    }
  };

  const openArticle = async (id: number) => {
    setLoadingArticle(true);
    try {
      const a = await articleApi.get(id);
      setSelectedArticle(a);
    } catch {
      /* ignore */
    } finally {
      setLoadingArticle(false);
    }
  };

  // Ctrl/Cmd + S 保存当前标签
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, activeTabId, title]); // eslint-disable-line react-hooks/exhaustive-deps

  const snippet = (html: string) =>
    (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) || "（空笔记）";

  const notePickerList = notes.filter((n) => !tabs.some((t) => t.id === n.id));

  return (
    <div className="h-screen flex flex-col">
      {/* Header / toolbar */}
      <div className="px-6 pt-5 pb-3 border-b border-ink-200/60 bg-white/70 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-ink-900 ink-title flex items-center gap-2">
              <span>📝</span> 随手记
            </h1>
            <p className="text-xs text-ink-400 mt-0.5">
              自由记录灵感，支持多级标题、字号与加粗；右侧为文章拆解历史，可左右对照
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleNewTab} className="btn-secondary text-sm">
              ＋ 新建
            </button>
            <div className="relative">
              <button
                onClick={() => setShowNotePicker((v) => !v)}
                className={`btn-add ${showNotePicker ? "bg-brand-100 text-brand-700 border-brand-200" : ""}`}
              >
                打开笔记 ▾
              </button>
              {showNotePicker && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowNotePicker(false)}
                  />
                  <div className="absolute right-0 mt-1 w-72 max-h-80 overflow-auto z-20 bg-white border border-ink-200 rounded-lg shadow-lg">
                    <div className="px-3 py-2 text-xs font-semibold text-ink-400 border-b border-ink-100 sticky top-0 bg-white">
                      选择笔记打开（{notePickerList.length}）
                    </div>
                    {notePickerList.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-ink-400 text-center">
                        已打开全部笔记 / 暂无其他笔记
                      </div>
                    ) : (
                      notePickerList.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-ink-50 border-b border-ink-50 last:border-0"
                        >
                          <button
                            onClick={() => openNoteTab(n)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <div className="text-sm font-medium text-ink-900 truncate">
                              {n.title || "未命名笔记"}
                            </div>
                            <div className="text-[11px] text-ink-400 truncate">
                              {snippet(n.content)}
                            </div>
                          </button>
                          <button
                            onClick={() => n.id != null && handleDeleteNote(n.id)}
                            className="text-seal-500 hover:bg-seal-50 rounded px-1.5 py-0.5 text-xs shrink-0"
                            title="删除"
                          >
                            删除
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => exportNotesDoc(notes)}
              disabled={notes.length === 0}
              className="btn-add disabled:opacity-40 disabled:cursor-not-allowed"
              title="导出全部笔记为 Word"
            >
              ⬇ 导出 Word
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? "保存中…" : "保存"}
            </button>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={`btn-add ${showHistory ? "bg-brand-100 text-brand-700 border-brand-200" : ""}`}
              title="展开/收起文章拆解历史"
            >
              {showHistory ? "收起历史 ◂" : "历史记录 ▸"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 flex-wrap -mb-3">
          {tabs.map((t) => (
            <div
              key={t.tabId}
              className={`group flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-t-lg border border-b-0 text-sm cursor-pointer max-w-[220px] ${
                t.tabId === activeTabId
                  ? "bg-white border-ink-200 text-ink-900 font-medium"
                  : "bg-ink-50/80 border-ink-200/60 text-ink-500 hover:bg-ink-100"
              }`}
              onClick={() => setActiveTabId(t.tabId)}
            >
              <span className="truncate">
                {t.title?.trim() || "未命名笔记"}
                {t.dirty && <span className="text-brand-600 ml-0.5">●</span>}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.tabId);
                }}
                className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-seal-600 text-xs leading-none"
                title="关闭"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={handleNewTab}
            className="ml-1 w-7 h-7 rounded-md border border-ink-200 bg-white hover:bg-ink-50 text-ink-500 text-sm shrink-0"
            title="新建笔记标签"
          >
            ＋
          </button>
        </div>
      </div>

      {/* Body: TOC + Editor + History */}
      <div className="flex-1 min-h-0 flex">
        {/* TOC sidebar */}
        <aside className="w-52 shrink-0 border-r border-ink-200/60 bg-white/50 p-4 overflow-auto">
          <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">目录跳转</div>
          {toc.length === 0 ? (
            <p className="text-xs text-ink-400 leading-relaxed">
              在正文里用「H1 / H2 / H3」标记标题后，这里会自动生成大纲，点击即可快速跳转。
            </p>
          ) : (
            <ul className="space-y-1">
              {toc.map((item) => (
                <li key={item.index}>
                  <button
                    onClick={() => jumpTo(item.index)}
                    className={`w-full text-left text-sm text-ink-600 hover:text-brand-700 hover:bg-brand-50 rounded px-2 py-1.5 transition-colors truncate ${
                      item.level === 1
                        ? "font-semibold"
                        : item.level === 2
                        ? "pl-4"
                        : "pl-7 text-ink-500"
                    }`}
                    title={item.text}
                  >
                    {item.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Editor */}
        <div className="flex-1 min-w-0 min-h-0 relative overflow-auto">
          <div className="max-w-3xl mx-auto px-8 py-6">
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="笔记标题（留空将自动取首个标题/首行）"
              className="input-field w-full mb-4 !py-2 font-semibold"
            />
            {isEmpty && activeTab && (
              <div className="pointer-events-none absolute left-8 top-24 text-ink-300 text-sm leading-relaxed">
                在这里自由书写… 选中文字后可「加粗」或调整「字号」；<br />
                用工具栏的 H1/H2/H3 标记标题，左侧目录会自动生成并可点击跳转。
              </div>
            )}
            <div
              ref={editorRef}
              className="note-editor min-h-[60vh] outline-none"
              contentEditable
              suppressContentEditableWarning
              onInput={onEditorInput}
              onKeyUp={saveSelection}
              onMouseUp={saveSelection}
            />
          </div>

          {/* Format toolbar floating */}
          <div className="sticky bottom-4 mx-auto w-fit flex items-center gap-1 flex-wrap px-2 py-1.5 rounded-xl border border-ink-200 bg-white/95 shadow-md backdrop-blur">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("bold")}
              className="w-9 h-9 rounded-md border border-ink-200 bg-white hover:bg-ink-50 font-bold text-ink-700"
              title="加粗"
            >
              B
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatBlock("H1")}
              className="h-9 px-2.5 rounded-md border border-ink-200 bg-white hover:bg-ink-50 text-ink-700 text-sm font-semibold"
              title="一级标题"
            >
              H1
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatBlock("H2")}
              className="h-9 px-2.5 rounded-md border border-ink-200 bg-white hover:bg-ink-50 text-ink-700 text-sm font-semibold"
              title="二级标题"
            >
              H2
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatBlock("H3")}
              className="h-9 px-2.5 rounded-md border border-ink-200 bg-white hover:bg-ink-50 text-ink-700 text-sm font-semibold"
              title="三级标题"
            >
              H3
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => formatBlock("P")}
              className="h-9 px-2.5 rounded-md border border-ink-200 bg-white hover:bg-ink-50 text-ink-700 text-sm"
              title="正文"
            >
              正文
            </button>
            <select
              onMouseDown={saveSelection}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v) applyFontSize(v);
                e.target.value = "0";
              }}
              defaultValue="0"
              className="h-9 px-2 rounded-md border border-ink-200 bg-white text-ink-700 text-sm"
              title="字号"
            >
              <option value="0">字号</option>
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}px
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* History panel: 文章拆解历史（右侧对照） */}
        {showHistory && (
          <aside className="w-96 shrink-0 min-h-0 border-l border-ink-200/60 bg-white/60 overflow-auto flex flex-col">
            <div className="px-4 py-3 border-b border-ink-200/60 flex items-center justify-between shrink-0">
              <span className="text-sm font-semibold text-ink-800">文章拆解历史（{articles.length}）</span>
              <span className="text-xs text-ink-400">点击可右栏对照</span>
            </div>

            {selectedArticle ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-4 py-2 flex items-center justify-between bg-ink-50/70 border-b border-ink-100 shrink-0 gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate">
                      {selectedArticle.title}
                    </div>
                    <div className="text-xs text-ink-400">
                      {selectedArticle.createdAt
                        ? new Date(selectedArticle.createdAt).toLocaleString("zh-CN")
                        : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      to={`/articles/${selectedArticle.id}`}
                      className="btn-add"
                      title="在拆解页打开"
                    >
                      完整拆解
                    </Link>
                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="btn-add"
                      title="返回列表"
                    >
                      返回
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-auto px-4 py-4">
                  <EditableAnalysisView result={toResult(selectedArticle)} editable={false} />
                </div>
              </div>
            ) : loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-7 h-7 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
              </div>
            ) : loadingArticle ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-7 h-7 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
              </div>
            ) : articles.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="text-3xl mb-2">📚</div>
                <p className="text-sm text-ink-500">还没有文章拆解记录</p>
                <p className="text-xs text-ink-400 mt-1">
                  在「文章拆解」中分析文章后，这里会出现历史记录，可对照着写笔记
                </p>
              </div>
            ) : (
              <ul className="flex-1 overflow-auto divide-y divide-ink-100">
                {articles.map((a) => (
                  <li key={a.id} className="px-4 py-3 hover:bg-ink-50/70 transition-colors">
                    <button onClick={() => openArticle(a.id!)} className="w-full text-left">
                      <div className="text-sm font-medium text-ink-900 truncate">{a.title}</div>
                      <div className="text-[11px] text-ink-400 mt-1">
                        {a.createdAt ? new Date(a.createdAt).toLocaleString("zh-CN") : ""}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => openArticle(a.id!)}
                        className="btn-add"
                        title="在右侧对照查看"
                      >
                        对照
                      </button>
                      <Link to={`/articles/${a.id}`} className="btn-add" title="在拆解页打开">
                        拆解页
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      {/* Toast */}
      {message && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-ink-900 text-white text-sm shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}
