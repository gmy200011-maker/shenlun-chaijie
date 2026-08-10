const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database
function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultDB = {
      users: [],
      articles: [],
      settings: [],
      interviewQuestions: [],
      quotes: [],
      solutionMethods: [],
      nextUserId: 1,
      nextArticleId: 1,
      nextSettingsId: 1,
      nextInterviewId: 1,
      nextQuoteId: 1,
      nextSolutionId: 1,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2));
  }
}

function readDB() {
  initDB();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  let data = JSON.parse(raw);
  // Backfill new collections for legacy databases
  const defaults = {
    interviewQuestions: [],
    quotes: [],
    solutionMethods: [],
    nextInterviewId: 1,
    nextQuoteId: 1,
    nextSolutionId: 1,
  };
  let changed = false;
  for (const k of Object.keys(defaults)) {
    if (data[k] === undefined) {
      data[k] = defaults[k];
      changed = true;
    }
  }
  if (changed) writeDB(data);
  return data;
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// User operations
function findUserByUsername(username) {
  const db = readDB();
  return db.users.find(u => u.username === username);
}

function findUserById(id) {
  const db = readDB();
  return db.users.find(u => u.id === id);
}

function createUser(username, hashedPassword) {
  const db = readDB();
  const user = {
    id: db.nextUserId++,
    username,
    password: hashedPassword,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  writeDB(db);
  return user;
}

// Article operations
function getArticlesByUserId(userId) {
  const db = readDB();
  return db.articles
    .filter(a => a.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getArticleById(id, userId) {
  const db = readDB();
  return db.articles.find(a => a.id === id && a.userId === userId);
}

function createArticle(userId, data) {
  const db = readDB();
  const article = {
    id: db.nextArticleId++,
    userId,
    title: data.title || '未命名文章',
    content: data.content || '',
    background: data.background || '',
    phenomenonAnalysis: data.phenomenonAnalysis || '',
    solutions: data.solutions || '',
    goldenQuotes: data.goldenQuotes || [],
    materialCases: data.materialCases || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.articles.push(article);

  // Auto-save interview question linked to this article
  if (data.interviewQuestion && data.interviewQuestion.question) {
    const iq = {
      id: db.nextInterviewId++,
      userId,
      articleId: article.id,
      articleTitle: article.title,
      question: data.interviewQuestion.question,
      type: data.interviewQuestion.type || '综合分析',
      answerIdea: data.interviewQuestion.answerIdea || '',
      createdAt: new Date().toISOString(),
    };
    db.interviewQuestions.push(iq);
  }

  writeDB(db);
  return article;
}

function updateArticle(id, userId, updates) {
  const db = readDB();
  const idx = db.articles.findIndex(a => a.id === id && a.userId === userId);
  if (idx === -1) return null;
  db.articles[idx] = {
    ...db.articles[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeDB(db);
  return db.articles[idx];
}

function deleteArticle(id, userId) {
  const db = readDB();
  const idx = db.articles.findIndex(a => a.id === id && a.userId === userId);
  if (idx === -1) return false;
  db.articles.splice(idx, 1);
  // Also delete linked interview questions
  db.interviewQuestions = db.interviewQuestions.filter(
    q => !(q.articleId === id && q.userId === userId)
  );
  writeDB(db);
  return true;
}

// Settings operations
// Legacy single-key shape: { apiKey, apiBaseUrl, model }
// New multi-profile shape: { profiles: [{id,name,apiBaseUrl,apiKey,model}], activeProfileId }
function migrateSettings(settings) {
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

function getSettings(userId) {
  const db = readDB();
  let settings = db.settings.find(s => s.userId === userId);
  if (!settings) {
    settings = {
      id: db.nextSettingsId++,
      userId,
      profiles: [],
      activeProfileId: '',
    };
    db.settings.push(settings);
    writeDB(db);
  }
  const migrated = migrateSettings(settings);
  if (migrated !== settings) writeDB(db);
  return migrated;
}

function updateSettings(userId, updates) {
  const db = readDB();
  let idx = db.settings.findIndex(s => s.userId === userId);
  if (idx === -1) {
    const settings = {
      id: db.nextSettingsId++,
      userId,
      profiles: updates.profiles || [],
      activeProfileId: updates.activeProfileId || '',
    };
    db.settings.push(settings);
    writeDB(db);
    return settings;
  }
  db.settings[idx] = { ...db.settings[idx], ...updates };
  const migrated = migrateSettings(db.settings[idx]);
  writeDB(db);
  return migrated;
}

// Material case search
function searchMaterialCases(userId, query) {
  const db = readDB();
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
          articleId: article.id,
          articleTitle: article.title,
        });
      }
    });
  });
  return cards;
}

// Interview question operations
function getInterviewQuestions(userId, { q = '', type = '' } = {}) {
  const db = readDB();
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
function createQuote(userId, data) {
  const db = readDB();
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
    quote: data.quote || '',
    source: data.source || '',
    tags: data.tags || [],
    createdAt: new Date().toISOString(),
  };
  db.quotes.push(quote);
  writeDB(db);
  return quote;
}

function getQuotes(userId, { q = '', tag = '' } = {}) {
  const db = readDB();
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
function createSolutionMethod(userId, data) {
  const db = readDB();
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
    heading: (data.heading || '').trim(),
    content,
    domain: data.domain || '政治',
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: new Date().toISOString(),
  };
  db.solutionMethods.push(method);
  writeDB(db);
  return method;
}

function getSolutionMethods(userId, { q = '', domain = '' } = {}) {
  const db = readDB();
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

// Stats
function getStats(userId) {
  const db = readDB();
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
  return {
    totalArticles: articles.length,
    totalCases: allCases.length,
    totalQuotes: quotesCount,
    totalInterviews: interviewsCount,
    totalSolutions: solutionsCount,
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

module.exports = {
  initDB,
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
  createSolutionMethod,
  getSolutionMethods,
  getStats,
};
