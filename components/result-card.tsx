import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MatchAnalysis } from "@/lib/types"
import { Gauge, KeyRound, MessageSquareText, Send, CheckCircle2, AlertTriangle } from "lucide-react"

function ScoreRing({ score, tone }: { score: number; tone: "good" | "mid" | "bad" }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color =
    tone === "good" ? "text-emerald-500" : tone === "mid" ? "text-amber-500" : "text-rose-500"

  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={radius} strokeWidth="6" className="stroke-muted" fill="none" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          className={cn("transition-all duration-700 ease-out", color)}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {score}
      </span>
    </div>
  )
}

function MetricRow({
  icon,
  title,
  children,
  confidence,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  confidence: number
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="mt-0.5 flex items-baseline gap-2">{children}</div>
          <p className="mt-1 text-xs text-muted-foreground">{confidence}% confidence</p>
        </div>
      </div>
    </div>
  )
}

const fitTone = { Strong: "good", Moderate: "mid", Weak: "bad" } as const
const keywordTone = { Excellent: "good", Good: "mid", Poor: "bad" } as const

export function ResultCard({ analysis }: { analysis: MatchAnalysis }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-balance">Match Results</CardTitle>
        <p className="text-pretty text-sm text-muted-foreground">{analysis.summary}</p>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <MetricRow icon={<Gauge className="h-4 w-4" />} title="Fit Level" confidence={analysis.fitLevel.confidence}>
          <div className="flex items-center gap-3">
            <ScoreRing score={analysis.fitLevel.score} tone={fitTone[analysis.fitLevel.label]} />
            <span className="text-lg font-semibold">{analysis.fitLevel.label}</span>
          </div>
        </MetricRow>

        <MetricRow icon={<Send className="h-4 w-4" />} title="Should Apply" confidence={analysis.shouldApply.confidence}>
          <Badge
            className={cn(
              "text-sm",
              analysis.shouldApply.value === "Yes"
                ? "bg-emerald-500 text-white hover:bg-emerald-500"
                : "bg-rose-500 text-white hover:bg-rose-500",
            )}
          >
            {analysis.shouldApply.value}
          </Badge>
        </MetricRow>

        <MetricRow
          icon={<KeyRound className="h-4 w-4" />}
          title="Keyword Match"
          confidence={analysis.keywordMatch.confidence}
        >
          <div className="flex items-center gap-3">
            <ScoreRing score={analysis.keywordMatch.score} tone={keywordTone[analysis.keywordMatch.label]} />
            <span className="text-lg font-semibold">{analysis.keywordMatch.label}</span>
          </div>
        </MetricRow>

        <MetricRow
          icon={<MessageSquareText className="h-4 w-4" />}
          title="CV Tone"
          confidence={analysis.cvTone.confidence}
        >
          <span className="text-lg font-semibold">{analysis.cvTone.value}</span>
        </MetricRow>
      </CardContent>
      {analysis.skills?.length > 0 && (
        <CardContent className="border-t pt-6">
          <p className="mb-3 text-sm font-medium">Skill Breakdown</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {analysis.skills.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {s.demonstrated ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <span className="truncate text-sm">{s.name}</span>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {s.confidence}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
