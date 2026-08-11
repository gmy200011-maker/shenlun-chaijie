import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Redis } from '@upstash/redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// On Vercel the deployed code directory (/var/task) is READ-ONLY, so any file
// persistence must go to the writable /tmp. Locally we keep the repo-local
// data/ folder. Without this, writeFileSync throws EROFS and the whole request
// 500s. /tmp is per-instance/ephemeral, so configure Upstash for real
// persistence — this is just a safe non-crashing fallback.
const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'shenlun-data')
  : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// ---- Storage backend selection ----
// On Vercel (serverless, read-only fs) we persist the whole database as a
// single JSON document in Upstash Redis. Locally (no UPSTASH_* env) we fall
// back to a plain file so development keeps working unchanged.
const USE_REDIS = !!(process.env.UPSTASH_URL && process.env.UPSTASH_TOKEN);
let redis = null;
if (USE_REDIS) {
  redis = new Redis({ url: process.env.UPSTASH_URL, token: process.env.UPSTASH_TOKEN });
}
const DB_KEY = 'shenlun_db';

function getDefaultDB() {
  return {
    users: [],
    articles: [],
    settings: [],
    interviewQuestions: [],
    quotes: [],
    solutionMethods: [],
    notes: [],
    nextUserId: 1,
    nextArticleId: 1,
    nextSettingsId: 1,
    nextInterviewId: 1,
    nextQuoteId: 1,
    nextSolutionId: 1,
    nextNoteId: 1,
  };
}

async function readDB() {
  let data;
  if (USE_REDIS) {
    data = await redis.get(DB_KEY);
    if (!data) {
      data = getDefaultDB();
      await redis.set(DB_KEY, data);
    }
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(getDefaultDB(), null, 2));
    }
    data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  }
  // Backfill new collections for legacy databases
  const defaults = {
    interviewQuestions: [],
    quotes: [],
    solutionMethods: [],
    notes: [],
    nextInterviewId: 1,
    nextQuoteId: 1,
    nextSolutionId: 1,
    nextNoteId: 1,
  };
  let changed = false;
  for (const k of Object.keys(defaults)) {
    if (data[k] === undefined) {
      data[k] = defaults[k];
      changed = true;
    }
  }
  if (changed) await writeDB(data);
  return data;
}

async function writeDB(data) {
  if (USE_REDIS) {
    await redis.set(DB_KEY, data);
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  }
}

// User operations
async function findUserByUsername(username) {
  const db = await readDB();
  return db.users.find(u => u.username === username);
}

async function findUserById(id) {
  const db = await readDB();
  return db.users.find(u => u.id === id);
}

async function createUser(username, hashedPassword) {
  const db = await readDB();
  const user = {
    id: db.nextUserId++,
    username,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await writeDB(db);
  return user;
}

// Article operations
async function getArticlesByUserId(userId) {
  const db = await readDB();
  return db.articles
    .filter(a => a.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getArticleById(id, userId) {
  const db = await readDB();
  return db.articles.find(a => a.id === id && a.userId === userId);
}

async function createArticle(userId, data) {
  const db = await readDB();
  const id = db.nextArticleId++;
  const now = new Date().toISOString();
  const materialCases = (data.materialCases || []).map((c, i) => ({
    ...c,
    id: `mc_${id}_${i}`,
  }));
  const goldenQuotes = (data.goldenQuotes || []).map((q, i) => ({
    ...q,
    id: `gq_${id}_${i}`,
  }));
  const solutions = (data.solutions || []).map((s, i) => ({
    ...s,
    id: `sm_${id}_${i}`,
  }));
  const article = {
    id,
    userId,
    title: data.title || '未命名文章',
    content: data.content || '',
    background: data.background || '',
    phenomenonAnalysis: data.phenomenonAnalysis || '',
    solutions,
    goldenQuotes,
    materialCases,
    createdAt: now,
    updatedAt: now,
  };
  db.articles.push(article);

  // Auto-save interview question linked to this article
  if (data.interviewQuestion && data.interviewQuestion.question) {
    const iqLinkId = `iq_${id}_0`;
    const iq = {
      id: db.nextInterviewId++,
      linkId: iqLinkId,
      userId,
      articleId: id,
      articleTitle: article.title,
      question: data.interviewQuestion.question,
      type: data.interviewQuestion.type || '综合分析',
      answerIdea: data.interviewQuestion.answerIdea || '',
      createdAt: now,
    };
    db.interviewQuestions.push(iq);
    article.interviewQuestion = { ...data.interviewQuestion, id: iqLinkId };
  }

  await writeDB(db);
  return article;
}

async function updateArticle(id, userId, updates) {
  const db = await readDB();
  const idx = db.articles.findIndex(a => a.id === id && a.userId === userId);
  if (idx === -1) return null;
  db.articles[idx] = {
    ...db.articles[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await writeDB(db);
  return db.articles[idx];
}

async function deleteArticle(id, userId) {
  const db = await readDB();
  const idx = db.articles.findIndex(a => a.id === id && a.userId === userId);
  if (idx === -1) return false;
  db.articles.splice(idx, 1);
  // Also delete linked interview questions
  db.interviewQuestions = db.interviewQuestions.filter(
    q => !(q.articleId === id && q.userId === userId)
  );
  await writeDB(db);
  return true;
}

// Settings operations
// Legacy single-key shape: { apiKey, apiBaseUrl, model }
// New multi-profile shape: { profiles: [{id,name,apiBaseUrl,apiKey,model}], activeProfileId }
async function migrateSettings(settings) {
  if (!settings.profiles) {
    const legacy = {
      id: 'legacy',
      name: '默认配置',
      apiBaseUrl: settings.apiBaseUrl || 'https://api.deepseek.com/v1',
      apiKey: settings.apiKey || '',
      model: settings.model || 'deepseek-chat',
    };
    settings.profiles = [legacy];
    settings.activeProfileId = legacy.id;
    // Drop legacy top-level fields to avoid confusion
    delete settings.apiKey;
    delete settings.apiBaseUrl;
    delete settings.model;
  }
  if (!Array.isArray(settings.profiles)) settings.profiles = [];
  if (!settings.activeProfileId || !settings.profiles.some(p => p.id === settings.activeProfileId)) {
    settings.activeProfileId = settings.profiles[0] ? settings.profiles[0].id : '';
  }
  return settings;
}

async function getSettings(userId) {
  const db = await readDB();
  let settings = db.settings.find(s => s.userId === userId);
  if (!settings) {
    settings = {
      id: db.nextSettingsId++,
      userId,
      profiles: [],
      activeProfileId: '',
    };
    db.settings.push(settings);
    await writeDB(db);
  }
  const migrated = await migrateSettings(settings);
  if (migrated !== settings) await writeDB(db);
  return migrated;
}

async function updateSettings(userId, updates) {
  const db = await readDB();
  let idx = db.settings.findIndex(s => s.userId === userId);
  if (idx === -1) {
    const settings = {
      id: db.nextSettingsId++,
      userId,
      profiles: updates.profiles || [],
      activeProfileId: updates.activeProfileId || '',
    };
    db.settings.push(settings);
    await writeDB(db);
    return settings;
  }
  db.settings[idx] = { ...db.settings[idx], ...updates };
  const migrated = await migrateSettings(db.settings[idx]);
  await writeDB(db);
  return migrated;
}

// Material case search
async function searchMaterialCases(userId, query) {
  const db = await readDB();
  const articles = db.articles.filter(a => a.userId === userId);
  const cards = [];
  articles.forEach(article => {
    const cases = article.materialCases || article.materialCards || [];
    cases.forEach((card, idx) => {
      const searchText = (
        card.summary + ' ' +
        (card.tags || []).join(' ') + ' ' +
        card.type + ' ' +
        (card.domain || '') + ' ' +
        card.usageScenario + ' ' +
        article.title + ' ' +
        (article.background || article.theme || '')
      ).toLowerCase();
      if (!query || searchText.includes(query.toLowerCase())) {
        cards.push({
          ...card,
          cardId: `${article.id}-${idx}`,
          linkId: card.id || `${article.id}-${idx}`,
          articleId: article.id,
          articleTitle: article.title,
        });
      }
    });
  });
  return cards;
}

// Interview question operations
async function getInterviewQuestions(userId, { q = '', type = '' } = {}) {
  const db = await readDB();
  let list = db.interviewQuestions.filter(iq => iq.userId === userId);
  if (type) {
    list = list.filter(iq => iq.type === type);
  }
  if (q) {
    const query = q.toLowerCase();
    list = list.filter(iq =>
      iq.question.toLowerCase().includes(query) ||
      iq.answerIdea.toLowerCase().includes(query) ||
      (iq.articleTitle || '').toLowerCase().includes(query)
    );
  }
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Quote operations (金句库)
async function createQuote(userId, data) {
  const db = await readDB();
  // Deduplicate: same quote + articleId
  const existing = db.quotes.find(
    q => q.userId === userId && q.quote === data.quote && q.articleId === data.articleId
  );
  if (existing) return existing;

  const quote = {
    id: db.nextQuoteId++,
    userId,
    articleId: data.articleId || null,
    articleTitle: data.articleTitle || '',
    linkId: data.linkId || null,
    quote: data.quote || '',
    source: data.source || '',
    tags: data.tags || [],
    createdAt: new Date().toISOString(),
  };
  db.quotes.push(quote);
  await writeDB(db);
  return quote;
}

async function getQuotes(userId, { q = '', tag = '' } = {}) {
  const db = await readDB();
  let list = db.quotes.filter(qt => qt.userId === userId);
  if (tag) {
    list = list.filter(qt => (qt.tags || []).includes(tag));
  }
  if (q) {
    const query = q.toLowerCase();
    list = list.filter(qt =>
      qt.quote.toLowerCase().includes(query) ||
      qt.source.toLowerCase().includes(query) ||
      (qt.articleTitle || '').toLowerCase().includes(query) ||
      (qt.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Solution method operations (解决方法库)
async function createSolutionMethod(userId, data) {
  const db = await readDB();
  const content = (data.content || '').trim();
  // Deduplicate: same content + articleId
  const existing = db.solutionMethods.find(
    m => m.userId === userId && m.content === content && m.articleId === data.articleId
  );
  if (existing) return existing;

  const method = {
    id: db.nextSolutionId++,
    userId,
    articleId: data.articleId || null,
    articleTitle: data.articleTitle || '',
    linkId: data.linkId || null,
    heading: (data.heading || '').trim(),
    content,
    domain: data.domain || '政治',
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: new Date().toISOString(),
  };
  db.solutionMethods.push(method);
  await writeDB(db);
  return method;
}

async function getSolutionMethods(userId, { q = '', domain = '' } = {}) {
  const db = await readDB();
  let list = db.solutionMethods.filter(m => m.userId === userId);
  if (domain) {
    list = list.filter(m => m.domain === domain);
  }
  if (q) {
    const query = q.toLowerCase();
    list = list.filter(m =>
      m.heading.toLowerCase().includes(query) ||
      m.content.toLowerCase().includes(query) ||
      (m.tags || []).some(t => t.toLowerCase().includes(query)) ||
      (m.articleTitle || '').toLowerCase().includes(query)
    );
  }
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Notes operations (随手记)
async function createNote(userId, data) {
  const db = await readDB();
  const note = {
    id: db.nextNoteId++,
    userId,
    title: (data.title || '').trim() || '未命名笔记',
    content: data.content || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.notes.push(note);
  await writeDB(db);
  return note;
}

async function updateNote(userId, id, data) {
  const db = await readDB();
  const idx = db.notes.findIndex(n => n.id === id && n.userId === userId);
  if (idx === -1) return null;
  db.notes[idx] = {
    ...db.notes[idx],
    title: (data.title || '').trim() || db.notes[idx].title,
    content: data.content || '',
    updatedAt: new Date().toISOString(),
  };
  await writeDB(db);
  return db.notes[idx];
}

async function getNotes(userId) {
  const db = await readDB();
  return db.notes
    .filter(n => n.userId === userId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function getNote(userId, id) {
  const db = await readDB();
  return db.notes.find(n => n.id === id && n.userId === userId) || null;
}

async function deleteNote(userId, id) {
  const db = await readDB();
  const idx = db.notes.findIndex(n => n.id === id && n.userId === userId);
  if (idx === -1) return false;
  db.notes.splice(idx, 1);
  await writeDB(db);
  return true;
}

// ===== In-place edit of library entries, with sync back to the source article =====
// New data carries linkId (the article-internal item id) for precise write-back;
// legacy data without linkId falls back to matching by the original content.
async function updateQuote(userId, id, data, sync) {
  const db = await readDB();
  const idx = db.quotes.findIndex((q) => q.id === id && q.userId === userId);
  if (idx === -1) return null;
  const q = db.quotes[idx];
  const next = {
    ...q,
    quote: data.quote != null ? String(data.quote).trim() : q.quote,
    source: data.source != null ? data.source : q.source,
    tags: Array.isArray(data.tags) ? data.tags : q.tags,
  };
  db.quotes[idx] = next;
  if (sync && q.articleId) {
    const a = db.articles.find((x) => x.id === q.articleId && x.userId === userId);
    if (a && Array.isArray(a.goldenQuotes)) {
      let i = q.linkId ? a.goldenQuotes.findIndex((g) => g.id === q.linkId) : -1;
      if (i === -1) i = a.goldenQuotes.findIndex((g) => g.quote === q.quote && g.source === q.source);
      if (i >= 0) {
        a.goldenQuotes[i] = { ...a.goldenQuotes[i], quote: next.quote, source: next.source };
        a.updatedAt = new Date().toISOString();
      }
    }
  }
  await writeDB(db);
  return next;
}

async function updateSolutionMethod(userId, id, data, sync) {
  const db = await readDB();
  const idx = db.solutionMethods.findIndex((m) => m.id === id && m.userId === userId);
  if (idx === -1) return null;
  const m = db.solutionMethods[idx];
  const next = {
    ...m,
    heading: data.heading != null ? data.heading : m.heading,
    content: data.content != null ? data.content : m.content,
    domain: data.domain != null ? data.domain : m.domain,
    tags: Array.isArray(data.tags) ? data.tags : m.tags,
  };
  db.solutionMethods[idx] = next;
  if (sync && m.articleId) {
    const a = db.articles.find((x) => x.id === m.articleId && x.userId === userId);
    if (a && Array.isArray(a.solutions)) {
      let i = m.linkId ? a.solutions.findIndex((s) => s.id === m.linkId) : -1;
      if (i === -1) i = a.solutions.findIndex((s) => s.content === m.content);
      if (i >= 0) {
        a.solutions[i] = { ...a.solutions[i], heading: next.heading, content: next.content };
        a.updatedAt = new Date().toISOString();
      }
    }
  }
  await writeDB(db);
  return next;
}

async function updateInterviewQuestion(userId, id, data, sync) {
  const db = await readDB();
  const idx = db.interviewQuestions.findIndex((q) => q.id === id && q.userId === userId);
  if (idx === -1) return null;
  const q = db.interviewQuestions[idx];
  const next = {
    ...q,
    question: data.question != null ? data.question : q.question,
    type: data.type != null ? data.type : q.type,
    answerIdea: data.answerIdea != null ? data.answerIdea : q.answerIdea,
  };
  db.interviewQuestions[idx] = next;
  if (sync && q.articleId) {
    const a = db.articles.find((x) => x.id === q.articleId && x.userId === userId);
    if (a) {
      a.interviewQuestion = {
        ...(a.interviewQuestion || {}),
        question: next.question,
        type: next.type,
        answerIdea: next.answerIdea,
      };
      a.updatedAt = new Date().toISOString();
    }
  }
  await writeDB(db);
  return next;
}

// Materials library is a direct aggregate of each article's materialCases,
// so editing a card writes straight back to the source article.
async function updateMaterialCase(userId, articleId, linkId, data) {
  const db = await readDB();
  const a = db.articles.find((x) => x.id === articleId && x.userId === userId);
  if (!a || !Array.isArray(a.materialCases)) return null;
  let idx = a.materialCases.findIndex((c) => c.id === linkId);
  if (idx === -1) {
    // legacy fallback: linkId may be `articleId-idx`
    const m = /^(\d+)-(\d+)$/.exec(linkId || '');
    if (m && Number(m[1]) === articleId) idx = Number(m[2]);
  }
  if (idx === -1 || !a.materialCases[idx]) return null;
  const c = a.materialCases[idx];
  a.materialCases[idx] = {
    ...c,
    summary: data.summary != null ? data.summary : c.summary,
    type: data.type != null ? data.type : c.type,
    domain: data.domain != null ? data.domain : c.domain,
    tags: Array.isArray(data.tags) ? data.tags : c.tags,
    usageScenario: data.usageScenario != null ? data.usageScenario : c.usageScenario,
  };
  a.updatedAt = new Date().toISOString();
  await writeDB(db);
  return a.materialCases[idx];
}

// Stats
async function getStats(userId) {
  const db = await readDB();
  const articles = db.articles.filter(a => a.userId === userId);
  const allCases = [];
  articles.forEach(article => {
    const cases = article.materialCases || article.materialCards || [];
    cases.forEach(c => allCases.push(c));
  });
  const casesByType = {};
  const casesByDomain = {};
  allCases.forEach(c => {
    casesByType[c.type] = (casesByType[c.type] || 0) + 1;
    if (c.domain) {
      casesByDomain[c.domain] = (casesByDomain[c.domain] || 0) + 1;
    }
  });
  const quotesCount = articles.reduce((sum, a) => sum + (a.goldenQuotes || []).length, 0);
  const interviewsCount = db.interviewQuestions.filter(iq => iq.userId === userId).length;
  const solutionsCount = db.solutionMethods.filter(m => m.userId === userId).length;
  const notesCount = db.notes.filter(n => n.userId === userId).length;
  return {
    totalArticles: articles.length,
    totalCases: allCases.length,
    totalQuotes: quotesCount,
    totalInterviews: interviewsCount,
    totalSolutions: solutionsCount,
    totalNotes: notesCount,
    casesByType,
    casesByDomain,
    recentArticles: articles
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(a => ({
        id: a.id,
        title: a.title,
        background: a.background || a.theme || '',
        createdAt: a.createdAt,
      })),
  };
}

export {
  readDB,
  writeDB,
  findUserByUsername,
  findUserById,
  createUser,
  getArticlesByUserId,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  getSettings,
  updateSettings,
  searchMaterialCases,
  getInterviewQuestions,
  createQuote,
  getQuotes,
  updateQuote,
  createSolutionMethod,
  getSolutionMethods,
  updateSolutionMethod,
  updateInterviewQuestion,
  updateMaterialCase,
  createNote,
  updateNote,
  getNotes,
  getNote,
  deleteNote,
  getStats,
};
