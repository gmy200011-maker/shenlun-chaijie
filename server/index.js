import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
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
  getStats,
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
} from './db.js';

const VALID_DOMAINS = ['政治', '经济', '文化', '社会', '生态'];

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'shenlun-toolkit-secret-key-2026';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Public health check (used by hosting platforms for probing)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Wrap an async handler so rejections become 500s instead of crashing the lambda
const wrap = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error('API error:', err);
    if (!res.headersSent) res.status(500).json({ error: '服务器内部错误' });
  });
};

// Auth middleware
async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: '未登录' });
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.id);
    if (!user) return res.status(401).json({ error: '用户不存在' });
    req.user = { id: user.id, username: user.username };
    next();
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// ============ Auth Routes ============

app.post('/api/auth/register', wrap(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度需在2-20个字符之间' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度不能少于6位' });
  }
  const existing = await findUserByUsername(username);
  if (existing) {
    return res.status(409).json({ error: '用户名已存在' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  const user = await createUser(username, hashed);
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username } });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  const user = await findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username } });
}));

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// ============ Article Routes ============

app.get('/api/articles', auth, wrap(async (req, res) => {
  const articles = await getArticlesByUserId(req.user.id);
  res.json(articles);
}));

app.get('/api/articles/:id', auth, wrap(async (req, res) => {
  const article = await getArticleById(parseInt(req.params.id), req.user.id);
  if (!article) return res.status(404).json({ error: '文章不存在' });
  res.json(article);
}));

app.post('/api/articles', auth, wrap(async (req, res) => {
  const article = await createArticle(req.user.id, req.body);
  res.json(article);
}));

app.put('/api/articles/:id', auth, wrap(async (req, res) => {
  const article = await updateArticle(parseInt(req.params.id), req.user.id, req.body);
  if (!article) return res.status(404).json({ error: '文章不存在' });
  res.json(article);
}));

app.delete('/api/articles/:id', auth, wrap(async (req, res) => {
  const ok = await deleteArticle(parseInt(req.params.id), req.user.id);
  if (!ok) return res.status(404).json({ error: '文章不存在' });
  res.json({ success: true });
}));

// ============ Settings Routes ============

app.get('/api/settings', auth, wrap(async (req, res) => {
  const settings = await getSettings(req.user.id);
  res.json(settings);
}));

app.put('/api/settings', auth, wrap(async (req, res) => {
  const settings = await updateSettings(req.user.id, req.body);
  res.json(settings);
}));

// ============ Stats Route ============

app.get('/api/stats', auth, wrap(async (req, res) => {
  const stats = await getStats(req.user.id);
  res.json(stats);
}));

// ============ Search Route ============

app.get('/api/materials/search', auth, wrap(async (req, res) => {
  const query = req.query.q || '';
  const results = await searchMaterialCases(req.user.id, query);
  res.json(results);
}));

// Edit a single material case (writes straight back to the source article)
app.put('/api/materials/:articleId/:linkId', auth, wrap(async (req, res) => {
  const updated = await updateMaterialCase(
    req.user.id,
    parseInt(req.params.articleId),
    req.params.linkId,
    req.body || {}
  );
  if (!updated) return res.status(404).json({ error: '素材不存在' });
  res.json({ success: true, card: updated });
}));

// ============ Interview Questions Routes ============

app.get('/api/interview-questions', auth, wrap(async (req, res) => {
  const { q = '', type = '' } = req.query;
  const results = await getInterviewQuestions(req.user.id, { q, type });
  res.json(results);
}));

app.put('/api/interview-questions/:id', auth, wrap(async (req, res) => {
  const updated = await updateInterviewQuestion(req.user.id, Number(req.params.id), req.body || {}, true);
  if (!updated) return res.status(404).json({ error: '面试题不存在' });
  res.json({ success: true, question: updated });
}));

// ============ Quotes (金句库) Routes ============

app.post('/api/quotes', auth, wrap(async (req, res) => {
  const { quote, source, articleId, articleTitle, tags } = req.body;
  if (!quote || !quote.trim()) {
    return res.status(400).json({ error: '金句内容不能为空' });
  }
  const saved = await createQuote(req.user.id, {
    quote: quote.trim(),
    source: source || '',
    articleId: articleId || null,
    articleTitle: articleTitle || '',
    tags: Array.isArray(tags) ? tags : [],
  });
  res.json({ success: true, quote: saved });
}));

app.get('/api/quotes', auth, wrap(async (req, res) => {
  const { q = '', tag = '' } = req.query;
  const results = await getQuotes(req.user.id, { q, tag });
  res.json(results);
}));

app.put('/api/quotes/:id', auth, wrap(async (req, res) => {
  const updated = await updateQuote(req.user.id, Number(req.params.id), req.body || {}, true);
  if (!updated) return res.status(404).json({ error: '金句不存在' });
  res.json({ success: true, quote: updated });
}));

// ============ Solution Methods (解决方法库) Routes ============

app.post('/api/solution-methods', auth, wrap(async (req, res) => {
  const { heading, content, domain, tags, articleId, articleTitle } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '解决方法内容不能为空' });
  }
  if (!domain || !VALID_DOMAINS.includes(domain)) {
    return res.status(400).json({ error: '请选择领域（政治/经济/文化/社会/生态）' });
  }
  const saved = await createSolutionMethod(req.user.id, {
    heading: heading || '',
    content: content.trim(),
    domain,
    tags: Array.isArray(tags) ? tags : [],
    articleId: articleId || null,
    articleTitle: articleTitle || '',
  });
  res.json({ success: true, method: saved });
}));

app.get('/api/solution-methods', auth, wrap(async (req, res) => {
  const { q = '', domain = '' } = req.query;
  const results = await getSolutionMethods(req.user.id, { q, domain });
  res.json(results);
}));

app.put('/api/solution-methods/:id', auth, wrap(async (req, res) => {
  const updated = await updateSolutionMethod(req.user.id, Number(req.params.id), req.body || {}, true);
  if (!updated) return res.status(404).json({ error: '解决方法不存在' });
  res.json({ success: true, method: updated });
}));

// ============ Notes (随手记) Routes ============

app.get('/api/notes', auth, wrap(async (req, res) => {
  res.json(await getNotes(req.user.id));
}));

app.get('/api/notes/:id', auth, wrap(async (req, res) => {
  const note = await getNote(req.user.id, Number(req.params.id));
  if (!note) return res.status(404).json({ error: '笔记不存在' });
  res.json(note);
}));

app.post('/api/notes', auth, wrap(async (req, res) => {
  const { title, content } = req.body;
  if (content === undefined || content === null) {
    return res.status(400).json({ error: '笔记内容不能为空' });
  }
  const saved = await createNote(req.user.id, {
    title: title || '',
    content: String(content),
  });
  res.json({ success: true, note: saved });
}));

app.put('/api/notes/:id', auth, wrap(async (req, res) => {
  const { title, content } = req.body;
  const updated = await updateNote(req.user.id, Number(req.params.id), {
    title: title || '',
    content: content === undefined ? '' : String(content),
  });
  if (!updated) return res.status(404).json({ error: '笔记不存在' });
  res.json({ success: true, note: updated });
}));

app.delete('/api/notes/:id', auth, wrap(async (req, res) => {
  const ok = await deleteNote(req.user.id, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: '笔记不存在' });
  res.json({ success: true });
}));

// ============ URL Fetch Route ============

app.post('/api/fetch-url', auth, wrap(async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: '请输入文章链接' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: '链接格式不正确' });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: '仅支持 http/https 链接' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return res.status(502).json({ error: `网页请求失败: HTTP ${response.status}` });
    }

    const html = await response.text();
    if (html.length < 100) {
      return res.status(400).json({ error: '网页内容为空或过短' });
    }

    let title = '';
    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
    if (titleMatch) {
      title = decodeHtmlEntities(titleMatch[1]);
    } else {
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match) {
        title = decodeHtmlEntities(stripTags(h1Match[1])).trim();
      } else {
        const titleTagMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
        if (titleTagMatch) {
          title = decodeHtmlEntities(titleTagMatch[1]).trim();
        }
      }
    }

    let contentText = '';
    const wxMatch = html.match(/<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|<script|<\/div>\s*<div\s+class=")/i);
    if (wxMatch) {
      contentText = stripTags(wxMatch[1]);
    } else {
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (articleMatch) {
        contentText = stripTags(articleMatch[1]);
      } else {
        const contentPatterns = [
          /<div[^>]*class="[^"]*article-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*rich_media_content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        ];
        for (const pattern of contentPatterns) {
          const match = html.match(pattern);
          if (match && match[1].length > 200) {
            contentText = stripTags(match[1]);
            break;
          }
        }
      }
    }

    if (!contentText || contentText.trim().length < 50) {
      let bodyHtml = html;
      bodyHtml = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
      bodyHtml = bodyHtml.replace(/<style[\s\S]*?<\/style>/gi, '');
      bodyHtml = bodyHtml.replace(/<nav[\s\S]*?<\/nav>/gi, '');
      bodyHtml = bodyHtml.replace(/<footer[\s\S]*?<\/footer>/gi, '');
      bodyHtml = bodyHtml.replace(/<header[\s\S]*?<\/header>/gi, '');
      bodyHtml = bodyHtml.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
      const bodyMatch = bodyHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        contentText = stripTags(bodyMatch[1]);
      } else {
        contentText = stripTags(bodyHtml);
      }
    }

    contentText = contentText
      .replace(/&nbsp;/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    const paragraphs = contentText.split('\n').map(p => p.trim()).filter(p => p.length > 10);
    contentText = paragraphs.join('\n\n');
    contentText = removeCopyrightAndFooter(contentText);

    if (contentText.length < 50) {
      return res.status(400).json({
        error: '无法从网页提取有效文章内容，请手动复制文章全文',
      });
    }

    res.json({ title, content: contentText, url });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: '网页请求超时，请检查链接或稍后重试' });
    }
    res.status(500).json({ error: `抓取网页失败: ${err.message}` });
  }
}));

// Helper: strip HTML tags and convert to text
function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Helper: decode HTML entities
function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Helper: remove copyright notices, footer boilerplate, and everything after
function removeCopyrightAndFooter(text) {
  const footerPatterns = [
    /版权[声明所有].*$/s,
    /凡注有.*$/s,
    /凡注明.*$/s,
    /凡标注.*$/s,
    /©.*$/s,
    /[Cc]opyright.*$/s,
    /编辑[:：]\s.*$/s,
    /责编[:：]\s.*$/s,
    /审核[:：]\s.*$/s,
    /来源[:：]\s.*$/s,
    /转自[:：]\s.*$/s,
    /声明[:：]\s.*$/s,
    /更多精彩.*$/s,
    /阅读原文.*$/s,
    /点赞.*在看.*$/s,
    /分享.*收藏.*$/s,
    /关注我.*$/s,
    /扫描.*二维码.*$/s,
    /长按.*识别.*$/s,
    /你可能.*感兴趣.*$/s,
    /推荐阅读.*$/s,
    /往期.*回顾.*$/s,
    /点击.*阅读.*$/s,
  ];

  let result = text;
  for (const pattern of footerPatterns) {
    const match = result.match(pattern);
    if (match && match.index !== undefined) {
      result = result.substring(0, match.index).trim();
    }
  }
  return result;
}

// Helper: resolve which API profile (provider/model/key) to actually use.
function getActiveConfig(settings) {
  const profiles = settings && settings.profiles;
  if (Array.isArray(profiles) && profiles.length > 0) {
    return profiles.find((p) => p.id === settings.activeProfileId) || profiles[0];
  }
  if (settings && settings.apiKey) {
    return {
      apiBaseUrl: settings.apiBaseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
    };
  }
  return null;
}

// ============ AI Analysis Route ============

app.post('/api/analyze', auth, wrap(async (req, res) => {
  const { content } = req.body;
  if (!content || content.trim().length < 50) {
    return res.status(400).json({ error: '文章内容过短，请至少输入50个字符' });
  }

  const settings = await getSettings(req.user.id);
  const activeConfig = getActiveConfig(settings);
  if (!activeConfig || !activeConfig.apiKey) {
    return res.status(400).json({
      error: '请先在设置页面配置并选择可用的AI API密钥',
      needSettings: true,
    });
  }

  const prompt = `你是一位专业的申论与面试备考辅导老师，专门负责拆解和分析"浙江宣传"微信公众号的文章，帮助用户积累申论大作文和公务员面试的素材。

请对以下文章进行系统拆解，以JSON格式输出结果。

拆解维度：
1. 写作背景 — 文章写作的时代背景、社会背景或政策背景（简洁概括，2-4句话）
2. 现象剖析 — 分析文章所讨论的现象为什么会出现，背后的深层原因。要求内容丰富、有逻辑层次：分2-3个层次展开，每层先亮明观点再用原文依据佐证，层层递进讲清"现象—原因—本质"
3. 解决方法 — 文章提出的或可以推导出的解决路径和具体做法。要求内容丰富、有逻辑层次：分条列出2-3条对策，每条对策包含"方向+具体举措+预期效果"，条理清晰可操作
4. 文章金句 — 摘录具有传播力和思想深度的金句。宁缺毋滥：原文没有合适的不要硬凑，最多5句
5. 素材案例 — 提取可用于申论和面试的素材案例。素材案例的严格定义是：一个有代表性的且可迁移的事例，即一个具体的事件、案例、政策举措、数据事实或典型做法，能够被迁移复用到不同主题、不同题型中。不符合这一定义的内容（纯观点、纯金句、空泛的概括或道理）不算素材，不要强行归入。宁缺毋滥：最多5个，若原文没有合适的素材可以少于5个甚至为0；每个素材必须归入五大领域之一（政治/经济/文化/社会/生态）

此外，请基于文章核心内容，自拟一道公务员考试面试模拟题，并给出参考回答思路。

约束：
1. 严禁编造原文中不存在的内容
2. 金句必须保留原汁原味，不得改写
3. 文章金句和素材案例若原文不合适，可少于上限数量甚至为空，绝不要硬凑；素材案例必须严格符合"有代表性且可迁移的具体事例"的定义，不符合的不要添加
4. 素材案例的domain字段必须是"政治""经济""文化""社会""生态"之一
5. 面试题目type字段必须从以下选一：综合分析、应急应变、组织管理、人际关系、情景模拟、自我认知
6. 现象剖析和解决方法要具体深入，避免空泛概括

请严格按照以下JSON格式输出，不要包含任何其他内容：

{
  "background": "写作背景（简洁概括）",
  "phenomenonAnalysis": [
    {"heading": "层次标题（如：表层现象/深层原因/本质根源）", "content": "该层次的详细阐述，结合原文依据，内容充实、逻辑清晰"}
  ],
  "solutions": [
    {"heading": "对策方向（如：制度建设/技术赋能/理念转变）", "content": "具体举措与预期效果，条理清晰、可操作"}
  ],
  "goldenQuotes": [
    {"quote": "金句原文", "source": "出处/位置"}
  ],
  "materialCases": [
    {"type": "政策类", "domain": "政治", "summary": "内容摘要", "tags": ["话题标签"], "usageScenario": "申论大作文/面试综合分析/面试组织计划"}
  ],
  "interviewQuestion": {
    "question": "基于文章核心内容自拟的公务员考试面试模拟题（题干清晰，题型明确）",
    "type": "综合分析",
    "answerIdea": "参考回答思路（有逻辑层次，按'审题破题—分析论证—对策总结'框架分点给出答题要点）"
  }
}

文章全文如下：

${content}`;

  try {
    const baseUrl = (activeConfig.apiBaseUrl || '').replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: activeConfig.model || 'gpt-4o',
        messages: [
          { role: 'system', content: '你是一位专业的申论与面试备考辅导老师。请只输出JSON，不要包含其他内容。' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({
        error: `AI服务返回错误: ${response.status}`,
        detail: errText.substring(0, 500),
      });
    }

    const data = await response.json();
    const rawContent = data.choices[0]?.message?.content || '';

    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      const firstBrace = rawContent.indexOf('{');
      const lastBrace = rawContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonStr = rawContent.substring(firstBrace, lastBrace + 1);
      }
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonStr);
    } catch {
      return res.status(500).json({
        error: 'AI返回格式解析失败，请重试或更换模型',
        raw: rawContent.substring(0, 500),
      });
    }

    res.json(analysis);
  } catch (err) {
    res.status(500).json({
      error: `请求AI服务失败: ${err.message}`,
    });
  }
}));

// ============ Serve static files (production, non-Vercel only) ============
// On Vercel the frontend is served by Vercel's static host and SPA routing is
// handled by vercel.json, so we skip express static hosting there.
if (!process.env.VERCEL) {
  const { existsSync: exists } = await import('fs');
  const { join: joinPath, dirname: dirOf } = await import('path');
  const { fileURLToPath: toPath } = await import('url');

  const __dirname = dirOf(toPath(import.meta.url));
  const clientDist = joinPath(__dirname, '..', 'client', 'dist_v2');

  if (exists(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(joinPath(clientDist, 'index.html'));
      }
    });
  }

  app.listen(PORT, () => {
    console.log(`\n  🚀 申论拆解工具服务已启动`);
    console.log(`  📡 API地址: http://localhost:${PORT}/api`);
    console.log(`  🌐 前端地址: http://localhost:${PORT} (生产模式)`);
    console.log(`  💻 开发模式: 在 client 目录运行 npm run dev\n`);
  });
}

export default app;
