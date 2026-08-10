// ===== Auth =====
export interface User {
  id: number;
  username: string;
}

// ===== Article Analysis =====
export interface GoldenQuote {
  quote: string;
  source: string;
}

export interface MaterialCase {
  type: string;
  domain?: string; // 五大领域：政治/经济/文化/社会/生态
  summary: string;
  tags: string[];
  usageScenario: string;
  // Runtime-only fields (from search results)
  cardId?: string;
  articleId?: number;
  articleTitle?: string;
}

// ===== Interview Question =====
export interface InterviewQuestion {
  id?: number;
  question: string;
  type: string; // 题型：综合分析/应急应变/组织管理/人际关系/情景模拟/自我认知
  answerIdea: string;
  articleId?: number;
  articleTitle?: string;
  createdAt?: string;
}

// ===== Quote (金句库) =====
export interface Quote {
  id?: number;
  quote: string;
  source: string;
  articleId?: number | null;
  articleTitle?: string;
  tags: string[];
  createdAt?: string;
}

// ===== Solution Method (解决方法库) =====
export interface SolutionMethod {
  id?: number;
  heading: string; // 对策方向/小标题
  content: string; // 具体举措与预期效果
  domain: string; // 五大领域之一：政治/经济/文化/社会/生态
  tags: string[]; // 自定义标签
  articleId?: number | null;
  articleTitle?: string;
  createdAt?: string;
}

// 层次化分析要点（现象剖析 / 解决方法 使用）
export interface AnalysisPoint {
  heading: string; // 层次小标题，如「表层表现」「深层根源」
  content: string; // 详细阐述
}

export interface Article {
  id: number;
  userId: number;
  title: string;
  content: string;
  background: string;
  phenomenonAnalysis: AnalysisPoint[];
  solutions: AnalysisPoint[];
  goldenQuotes: GoldenQuote[];
  materialCases: MaterialCase[];
  interviewQuestion?: InterviewQuestion;
  createdAt: string;
  updatedAt: string;
}

// ===== Stats =====
export interface Stats {
  totalArticles: number;
  totalCases: number;
  totalQuotes: number;
  totalInterviews: number;
  totalSolutions: number;
  casesByType: Record<string, number>;
  casesByDomain: Record<string, number>;
  recentArticles: {
    id: number;
    title: string;
    background: string;
    createdAt: string;
  }[];
}

// ===== Settings =====
// 每个服务商/模型组合独立保存一份配置，可同时存在多份，并通过 activeProfileId 选择当前使用的那一份
export interface ApiProfile {
  id: string; // 稳定标识：预设为服务商名，自定义为 custom-<时间戳>
  name: string; // 显示名称
  apiBaseUrl: string;
  apiKey: string;
  model: string;
}

export interface Settings {
  profiles: ApiProfile[];
  activeProfileId: string;
}

// ===== Analysis Result =====
export interface AnalysisResult {
  background: string;
  phenomenonAnalysis: AnalysisPoint[];
  solutions: AnalysisPoint[];
  goldenQuotes: GoldenQuote[];
  materialCases: MaterialCase[];
  interviewQuestion?: InterviewQuestion;
}
