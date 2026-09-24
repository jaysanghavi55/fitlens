export type SkillStatus = "demonstrated" | "inferred" | "unverified" | "missing"

// ─── Phase 3: Level / Satisfaction (additive, report-only in v1) ───
// Evidence answers "is it evidenced?"; Satisfaction answers "does the evidenced level satisfy the
// JD's required level?" — evaluated ONLY where the JD states an explicit threshold (JD-only trigger).
export type Satisfaction = "satisfied" | "insufficient" | "unknown"
export type RequiredLevel = {
  kind: "experience-depth" | "years" | "language-cefr"
  requiredEvidence: string // verbatim JD span that sets the bar
  threshold: string        // normalized target: "production" | "5" | "C1" | "advanced"
}

export type MatchAnalysis = {
  fitLevel: {
    score: number
    label: "Strong" | "Moderate" | "Weak"
    confidence: number
  }
  shouldApply: {
    value: "Yes" | "Borderline" | "No"
    confidence: number
    source: "jev" | "llm"
    reasoning?: string
  }
  skillMatch: {
    score: number
    label: "Strong" | "Moderate" | "Weak"
  }
  keywordMatch: {
    score: number
    label: "Excellent" | "Good" | "Poor"
    confidence: number
  }
  cvTone: {
    value: "Professional" | "Technical" | "Generic"
    confidence: number
  }
  skills: {
    name: string
    status: SkillStatus
    confidence: number
    evidence: string | null
    source: "jev" | "llm"
    reasoning?: string
    // ─── Phase 3 (additive, all optional) — present only for threshold-bearing requirements ───
    requiredLevel?: RequiredLevel | null
    candidateLevel?: string | null
    candidateEvidence?: string | null
    satisfaction?: Satisfaction
    satisfactionConfidence?: number
  }[]
  routing: {
    total: number
    escalated: number
    jevHandled: number
  }
  summary: string
}
