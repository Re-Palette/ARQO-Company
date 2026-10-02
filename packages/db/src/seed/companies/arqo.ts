/**
 * Company profile: ARQO. Everything here is data that a different company
 * would replace; F.R.I.D.A.Y. code never references these values.
 */
export const companyName = "ARQO";

export const divisions = [
  { id: "coo", name: "COO", nameJa: "COO室", kind: "executive", mission: "会社全体を動かす", color: "#E9B872", icon: "brain", sortOrder: 0 },
  { id: "executive", name: "Executive Assistant", nameJa: "秘書室", kind: "corporate", mission: "CEOの時間を守る", color: "#A5B4FC", icon: "calendar", sortOrder: 1 },
  { id: "strategy", name: "Strategy", nameJa: "戦略部", kind: "corporate", mission: "勝ち筋を描く", color: "#60A5FA", icon: "compass", sortOrder: 2 },
  { id: "research", name: "Research", nameJa: "リサーチ部", kind: "corporate", mission: "世界を知る", color: "#22D3EE", icon: "search", sortOrder: 3 },
  { id: "development", name: "Development", nameJa: "開発部", kind: "corporate", mission: "作る", color: "#4C8DFF", icon: "code", sortOrder: 4 },
  { id: "marketing", name: "Marketing", nameJa: "マーケティング部", kind: "corporate", mission: "届ける", color: "#F472B6", icon: "megaphone", sortOrder: 5 },
  { id: "sales", name: "Sales", nameJa: "営業部", kind: "corporate", mission: "つなぐ", color: "#34D399", icon: "handshake", sortOrder: 6 },
  { id: "finance", name: "Finance", nameJa: "財務部", kind: "corporate", mission: "守る・増やす", color: "#FBBF24", icon: "coins", sortOrder: 7 },
  { id: "creative", name: "Creative", nameJa: "デザイン部", kind: "corporate", mission: "魅せる", color: "#C084FC", icon: "palette", sortOrder: 8 },
  { id: "operations", name: "Operations", nameJa: "運営部", kind: "corporate", mission: "回す", color: "#94A3B8", icon: "settings", sortOrder: 9 },
  { id: "repalette", name: "Re-Palette", nameJa: "Re-Palette事業部", kind: "business_unit", mission: "美容と福祉で社会を彩る", color: "#F2A7C3", icon: "flower", sortOrder: 10 },
];

/** Phase 0 mock agents. More are hired through the Agent Registry. */
export const agents = [
  { id: "friday", displayName: "F.R.I.D.A.Y.", title: "COO", divisionId: "coo", level: "executive",
    persona: "冷静で俯瞰的。結論から話し、CEOの時間を最優先する。",
    responsibilities: ["指示理解", "タスク分解", "部署振り分け", "成果統合", "CEO提案", "全社最適化"],
    deliverableTypes: ["proposal", "integrated", "daily_executive_report"],
    modelTier: "deep", metricSet: ["common.adoption_rate", "common.tasks_completed", "common.completion_rate"] },
  { id: "researcher", displayName: "Research AI", title: "リサーチ部長", divisionId: "research", level: "lead", reportsTo: "friday",
    persona: "好奇心旺盛で出典に厳密。事実と推測を分けて書く。",
    responsibilities: ["Web調査", "AIニュース", "美容ニュース", "論文", "補助金・助成金"],
    deliverableTypes: ["research_report"], modelTier: "standard",
    metricSet: ["research.report_count", "research.adoption_rate", "research.reference_count"] },
  { id: "cmo", displayName: "Marketing AI", title: "CMO", divisionId: "marketing", level: "lead", reportsTo: "friday",
    persona: "ブランドの声を守りながら、数字で語るマーケター。",
    responsibilities: ["SNS", "SEO", "コンテンツ", "コミュニティ"],
    deliverableTypes: ["sns_post_draft", "marketing_report"], modelTier: "standard",
    metricSet: ["marketing.post_count", "marketing.adoption_rate", "marketing.outcome_count"] },
];

/**
 * Project tree. F.R.I.D.A.Y. is a child of ARQO for portfolio purposes only;
 * the system itself has no dependency on this structure.
 */
export const projects = [
  { slug: "arqo", name: "ARQO", category: "company", templateKey: "company", ownerDivisionId: "coo",
    description: "会社本体", pinned: false, sortOrder: 0, color: "#E9B872" },
  { slug: "friday", name: "F.R.I.D.A.Y.", category: "product", templateKey: "software_product", parent: "arqo",
    ownerDivisionId: "development", description: "AI COMPANY OS", pinned: true, sortOrder: 1, color: "#4C8DFF",
    customFields: { stage: "Phase 0" } },
  { slug: "repalette", name: "Re-Palette", category: "social_business", templateKey: "social_program", parent: "arqo",
    ownerDivisionId: "repalette", description: "美容福祉・不登校支援", pinned: true, sortOrder: 2, color: "#F2A7C3",
    dataSensitivity: "restricted",
    customFields: { domains: ["beauty_welfare", "youth_support", "events", "grants", "academic", "partnerships", "impact", "sns"] } },
  { slug: "newtone", name: "NEWTONE", category: "venture", templateKey: "venture", parent: "arqo",
    ownerDivisionId: "strategy", pinned: true, sortOrder: 3, status: "planning", color: "#22D3EE" },
  { slug: "university", name: "University", category: "personal_growth", templateKey: "study", parent: "arqo",
    ownerDivisionId: "executive", pinned: true, sortOrder: 4, color: "#A5B4FC" },
  { slug: "future-ventures", name: "Future Ventures", category: "portfolio", templateKey: "portfolio", parent: "arqo",
    ownerDivisionId: "strategy", pinned: true, sortOrder: 5, color: "#34D399" },
  { slug: "personal", name: "Personal", category: "personal", templateKey: "personal", ownerDivisionId: "executive",
    description: "個人事業・個人タスク（ARQO外）", pinned: false, sortOrder: 6, color: "#94A3B8" },
];

export const kpis = [
  { key: "repalette.beneficiaries", name: "受益者数", project: "repalette", domain: "all", unit: "人", period: "monthly", isHeadline: true },
  { key: "repalette.activities", name: "活動実施回数", project: "repalette", domain: "all", unit: "回", period: "monthly", isHeadline: true },
  { key: "repalette.grant_awarded", name: "助成金獲得額", project: "repalette", domain: "grants", unit: "円", period: "yearly", isHeadline: true },
  { key: "repalette.outcome_improvement", name: "アウトカム改善率", project: "repalette", domain: "impact", unit: "%", period: "quarterly", isHeadline: true },
  { key: "repalette.partners", name: "連携団体数", project: "repalette", domain: "partnerships", unit: "団体", period: "cumulative", isHeadline: true },
];
