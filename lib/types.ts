export type MatchAnalysis = {
  fitLevel: {
    score: number
    label: "Strong" | "Moderate" | "Weak"
    confidence: number
  }
  shouldApply: {
    value: "Yes" | "No"
    confidence: number
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
    demonstrated: boolean 
    confidence: number 
  }[]

  summary: string
}
