export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type FakeOrderFilter = "all" | "high" | "medium" | "low" | "verified";
export type VerificationStatus = "NORMAL" | "QUEUED" | "VERIFIED" | "FAKE";
export type CustomerFlagStatus = "NORMAL" | "WATCHLIST" | "BLOCKED";

export type RiskFactor = {
  label: string;
  points: number;
};

export type RiskAssessment = {
  factors: RiskFactor[];
  level: RiskLevel;
  score: number;
};
