import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MatchAnalysis, SkillStatus } from "@/lib/types"
import {
  Gauge,
  KeyRound,
  MessageSquareText,
  ListChecks,
  CheckCircle2,
  CircleDashed,
  HelpCircle,
  XCircle,
  ThumbsUp,
  MinusCircle,
  ThumbsDown,
} from "lucide-react"

type Tone = "good" | "mid" | "bad"

const TONE_TEXT: Record<Tone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  mid: "text-amber-600 dark:text-amber-400",
  bad: "text-rose-600 dark:text-rose-400",
}
const TONE_BAR: Record<Tone, string> = {
  good: "bg-emerald-500",
  mid: "bg-amber-500",
  bad: "bg-rose-500",
}
const TONE_RING: Record<Tone, string> = {
  good: "text-emerald-500",
  mid: "text-amber-500",
  bad: "text-rose-500",
}

function ScoreRing({ score, tone }: { score: number; tone: Tone }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

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
          className={cn("transition-all duration-700 ease-out", TONE_RING[tone])}
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

function LensBar({ score, tone }: { score: number; tone: Tone }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out", TONE_BAR[tone])}
        style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
      />
    </div>
  )
}

// Which model produced this decision: Jev (fast, default) or GPT (escalated by the router).
function SourceBadge({ source }: { source: "jev" | "llm" }) {
  return source === "llm" ? (
    <span
      title="Escalated to GPT — Jev was uncertain, so the router asked gpt-5-mini for a reasoned second opinion."
      className="shrink-0 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400"
    >
      🔍 GPT
    </span>
  ) : (
    <span
      title="Decided by Jev — the fast decision model was confident, no escalation needed."
      className="shrink-0 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400"
    >
      ⚡ Jev
    </span>
  )
}

// Visual config per evidence status.
const STATUS_META: Record<
  SkillStatus,
  { label: string; icon: typeof CheckCircle2; iconClass: string; textClass: string }
> = {
  demonstrated: {
    label: "demonstrated",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
  },
  inferred: {
    label: "inferred",
    icon: CircleDashed,
    iconClass: "text-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
  },
  unverified: {
    label: "unverified",
    icon: HelpCircle,
    iconClass: "text-muted-foreground",
    textClass: "text-muted-foreground",
  },
  missing: {
    label: "gap",
    icon: XCircle,
    iconClass: "text-rose-500",
    textClass: "text-rose-600 dark:text-rose-400",
  },
}

const fitTone: Record<"Strong" | "Moderate" | "Weak", Tone> = {
  Strong: "good",
  Moderate: "mid",
  Weak: "bad",
}
const keywordTone: Record<"Excellent" | "Good" | "Poor", Tone> = {
  Excellent: "good",
  Good: "mid",
  Poor: "bad",
}

// Verdict styling for the hero Should-Apply banner.
const VERDICT_META = {
  Yes: {
    icon: ThumbsUp,
    text: "text-emerald-700 dark:text-emerald-300",
    panel: "border-emerald-500/30 bg-emerald-500/10",
    accent: "bg-emerald-500",
    blurb: "Strong enough to be worth your time.",
  },
  Borderline: {
    icon: MinusCircle,
    text: "text-amber-700 dark:text-amber-300",
    panel: "border-amber-500/30 bg-amber-500/10",
    accent: "bg-amber-500",
    blurb: "Genuinely too close to call.",
  },
  No: {
    icon: ThumbsDown,
    text: "text-rose-700 dark:text-rose-300",
    panel: "border-rose-500/30 bg-rose-500/10",
    accent: "bg-rose-500",
    blurb: "The evidence doesn't back a confident apply.",
  },
} as const

function VerdictBanner({ apply }: { apply: MatchAnalysis["shouldApply"] }) {
  const meta = VERDICT_META[apply.value]
  const Icon = meta.icon
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-xl border p-5 sm:flex-row sm:items-center sm:gap-5",
        meta.panel,
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", meta.accent)} aria-hidden="true" />
      <div className="flex items-center gap-4">
        <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-background/70", meta.text)}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Should you apply?</p>
          <div className="flex items-center gap-3">
            <span className={cn("text-3xl font-bold tracking-tight", meta.text)}>{apply.value}</span>
            <SourceBadge source={apply.source} />
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 sm:border-l sm:border-foreground/10 sm:pl-5">
        <p className="text-sm leading-relaxed text-foreground/80">{apply.reasoning ?? meta.blurb}</p>
        {apply.value !== "Borderline" && (
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">{apply.confidence}% confidence</p>
        )}
      </div>
    </div>
  )
}

function LensCard({
  icon,
  title,
  caption,
  score,
  label,
  tone,
  confidence,
  primary,
}: {
  icon: React.ReactNode
  title: string
  caption: string
  score: number
  label: string
  tone: Tone
  confidence?: number
  primary?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        primary && "ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">{icon}</span>
        <span className="text-sm font-medium text-foreground">{title}</span>
        {primary && (
          <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            primary
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {primary ? (
          <ScoreRing score={score} tone={tone} />
        ) : (
          <span className={cn("text-3xl font-bold tabular-nums", TONE_TEXT[tone])}>{score}</span>
        )}
        <div className="min-w-0">
          <p className={cn("text-lg font-semibold leading-tight", TONE_TEXT[tone])}>{label}</p>
          {typeof confidence === "number" && (
            <p className="text-xs text-muted-foreground tabular-nums">{confidence}% confidence</p>
          )}
        </div>
      </div>
      <LensBar score={score} tone={tone} />
      <p className="text-xs leading-relaxed text-muted-foreground">{caption}</p>
    </div>
  )
}

const LEGEND: { status: SkillStatus; text: string }[] = [
  { status: "demonstrated", text: "named, direct" },
  { status: "inferred", text: "one tool implied" },
  { status: "unverified", text: "tool not confirmed" },
  { status: "missing", text: "gap" },
]

export function ResultCard({ analysis }: { analysis: MatchAnalysis }) {
  const routing = analysis.routing

  return (
    <div className="animate-reveal flex flex-col gap-4">
      {/* Summary strip */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Match Results</h2>
        <p className="text-pretty text-sm text-muted-foreground">{analysis.summary}</p>
      </div>

      {/* 1 — Hero verdict */}
      <VerdictBanner apply={analysis.shouldApply} />

      {/* 2 — Three lenses on the same CV, on purpose */}
      <div>
        <p className="mb-2 text-sm font-medium">
          Three lenses on your fit <span className="font-normal text-muted-foreground">— they disagree on purpose</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <LensCard
            icon={<Gauge className="h-4 w-4" />}
            title="Fit Level"
            caption="Jev's holistic judgment of the whole match."
            score={analysis.fitLevel.score}
            label={analysis.fitLevel.label}
            tone={fitTone[analysis.fitLevel.label]}
            confidence={analysis.fitLevel.confidence}
            primary
          />
          <LensCard
            icon={<ListChecks className="h-4 w-4" />}
            title="Skill Coverage"
            caption="Deterministic roll-up of the evidence — no model."
            score={analysis.skillMatch.score}
            label={analysis.skillMatch.label}
            tone={fitTone[analysis.skillMatch.label]}
          />
          <LensCard
            icon={<KeyRound className="h-4 w-4" />}
            title="Keyword Match"
            caption="Naive literal term overlap — the foil."
            score={analysis.keywordMatch.score}
            label={analysis.keywordMatch.label}
            tone={keywordTone[analysis.keywordMatch.label]}
            confidence={analysis.keywordMatch.confidence}
          />
        </div>
      </div>

      {/* 3 — Secondary detail */}
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">CV Tone</p>
          <p className="text-lg font-semibold leading-tight">{analysis.cvTone.value}</p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {analysis.cvTone.confidence}% confidence
        </p>
      </div>

      {/* 4 — Skill breakdown centerpiece */}
      {analysis.skills?.length > 0 && (
        <Card>
          <CardContent className="pt-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Skill Breakdown</p>
              {routing && (
                <p
                  title="The router keeps confident calls on Jev and escalates only the uncertain ones to GPT."
                  className="text-xs tabular-nums text-muted-foreground"
                >
                  ⚡ Jev {routing.jevHandled} · 🔍 GPT {routing.escalated}{" "}
                  <span className="text-muted-foreground/60">of {routing.total}</span>
                </p>
              )}
            </div>

            {/* status legend */}
            <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5">
              {LEGEND.map(({ status, text }) => {
                const meta = STATUS_META[status]
                const Icon = meta.icon
                return (
                  <span key={status} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Icon className={cn("h-3.5 w-3.5", meta.iconClass)} />
                    <span className={meta.textClass}>{meta.label}</span>
                    <span className="text-muted-foreground/60">— {text}</span>
                  </span>
                )
              })}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {analysis.skills.map((s, i) => {
                const meta = STATUS_META[s.status]
                const Icon = meta.icon
                // Disambiguate missing: an evidence span means the CV explicitly disclaims it,
                // null means it was simply never mentioned.
                const statusLabel =
                  s.status === "missing" ? (s.evidence ? "stated gap" : "not mentioned") : meta.label
                // Explain the statuses people misread. "unverified" is the big one:
                // it means a related capability is present but this exact tool isn't confirmed.
                const statusNote =
                  s.status === "unverified"
                    ? "Related capability present, but this specific tool isn’t confirmed in the CV — worth asking about."
                    : null
                return (
                  <div
                    key={s.name}
                    className="animate-reveal rounded-lg border bg-card px-3 py-2"
                    style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Icon className={cn("h-4 w-4 shrink-0", meta.iconClass)} />
                        <span className="truncate text-sm">{s.name}</span>
                        <SourceBadge source={s.source} />
                      </div>
                      <span className={cn("shrink-0 text-xs tabular-nums", meta.textClass)}>
                        {s.confidence}% {statusLabel}
                      </span>
                    </div>
                    {s.evidence && (
                      <p className="mt-1.5 pl-6 text-xs italic leading-relaxed text-muted-foreground">
                        “{s.evidence}”
                      </p>
                    )}
                    {statusNote && (
                      <p className="mt-1.5 pl-6 text-xs leading-relaxed text-muted-foreground/80">{statusNote}</p>
                    )}
                    {s.reasoning && (
                      <p className="mt-1 pl-6 text-xs leading-relaxed text-muted-foreground">{s.reasoning}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
