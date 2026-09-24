import { Card, CardContent } from "@/components/ui/card"
import { CollapsibleCard } from "@/components/collapsible-card"
import { cn } from "@/lib/utils"
import type { MatchAnalysis, SkillStatus, Satisfaction, RequiredLevel } from "@/lib/types"
import {
  Gauge,
  KeyRound,
  MessageSquareText,
  ListChecks,
  ClipboardCheck,
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

// ── Display banding ────────────────────────────────────────────────────────
// The score is authoritative (produced by the frozen backend); the LABEL is a pure
// presentation function of the score, computed here — not read from the payload's
// `label` field. One consistent 0–100 vocabulary across all three metrics, so a 26
// never reads as "Moderate" and a 30 never reads as "Good".
type Band = "Very Low" | "Low" | "Moderate" | "Good" | "Excellent"
function band(score: number): { label: Band; tone: Tone } {
  if (score >= 80) return { label: "Excellent", tone: "good" }
  if (score >= 60) return { label: "Good", tone: "good" }
  if (score >= 40) return { label: "Moderate", tone: "mid" }
  if (score >= 20) return { label: "Low", tone: "bad" }
  return { label: "Very Low", tone: "bad" }
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

// Visual config per evidence status. Labels are user-facing (no internal jargon like
// "gap" / "not mentioned"): what the CV shows about a capability, independent of whether
// it clears any explicit requirement bar.
const STATUS_META: Record<
  SkillStatus,
  { label: string; icon: typeof CheckCircle2; iconClass: string; textClass: string }
> = {
  demonstrated: {
    label: "Demonstrated",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
  },
  inferred: {
    label: "Inferred",
    icon: CircleDashed,
    iconClass: "text-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
  },
  unverified: {
    label: "Not verified",
    icon: HelpCircle,
    iconClass: "text-muted-foreground",
    textClass: "text-muted-foreground",
  },
  missing: {
    label: "Not demonstrated",
    icon: XCircle,
    iconClass: "text-rose-500",
    textClass: "text-rose-600 dark:text-rose-400",
  },
}

// ── Satisfaction lens ────────────────────────────────────────────────────────
// Distinct from evidence status on purpose: "does the evidenced level meet the JD's
// explicit bar?" satisfied / insufficient / unknown — never collapsed into a score.
const SAT_META: Record<
  Satisfaction,
  { label: string; icon: typeof CheckCircle2; iconClass: string; textClass: string; chip: string }
> = {
  satisfied: {
    label: "Satisfied",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  insufficient: {
    label: "Insufficient",
    icon: XCircle,
    iconClass: "text-rose-500",
    textClass: "text-rose-600 dark:text-rose-400",
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  unknown: {
    label: "Unknown",
    icon: HelpCircle,
    iconClass: "text-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
}

// Neutral chip used when the evidence lens should visually lead — e.g. a not-demonstrated
// requirement whose closest signal is below the bar shouldn't read as a second red failure.
const CHIP_MUTED = "border-muted-foreground/25 bg-muted text-muted-foreground"

// The JD's bar, phrased for a human.
function formatRequired(r: RequiredLevel): string {
  if (r.kind === "years") return `${r.threshold}+ years`
  if (r.kind === "language-cefr") return `${r.threshold} (CEFR)`
  return r.threshold // experience-depth: "Advanced", "Production experience", "Expert-level"
}

// The CV side of a requirement row. Presentation-only derivation from fields the backend
// already emits — nothing recomputed. Three shapes:
//  • unknown  → show the CV evidence that exists (so it never reads "not established" when
//               the CV clearly says something); the note explains what specifically is unset.
//  • insufficient + not-demonstrated → the closest signal that still sits below the bar.
//  • otherwise → the established candidate level.
function cvSide(s: MatchAnalysis["skills"][number]): { label: string; value: string } {
  const sat = s.satisfaction as Satisfaction
  if (sat === "unknown") {
    const ev = s.candidateEvidence ?? s.evidence ?? s.candidateLevel
    return { label: "CV evidence", value: ev ?? "not established" }
  }
  if (sat === "insufficient" && s.status === "missing") {
    return { label: "Closest CV signal", value: s.candidateLevel ?? "not established" }
  }
  return { label: "In your CV", value: s.candidateLevel ?? "not established" }
}

// A short, honest note that explains WHY a row is unknown, or why a not-demonstrated skill
// still counts as below-requirement. Keeps the two lenses (evidence vs satisfaction) legible.
function satNote(req: RequiredLevel, sat: Satisfaction, status: SkillStatus): string | null {
  if (sat === "unknown") {
    if (req.kind === "years") return "Duration not stated in the CV — the threshold can’t be confirmed."
    if (req.kind === "language-cefr")
      return `No comparable CEFR level is stated in the CV — FitLens does not infer ${req.threshold} from terms such as “fluent”.`
    return "Depth not established from the CV — not enough to confirm or rule out."
  }
  if (sat === "insufficient" && status === "missing") {
    return "The specific requirement isn’t evidenced; the closest signal in the CV sits below the bar."
  }
  return null
}

// Verdict styling for the Application Outlook banner.
const VERDICT_META = {
  Yes: {
    icon: ThumbsUp,
    text: "text-emerald-700 dark:text-emerald-300",
    panel: "border-emerald-500/30 bg-emerald-500/10",
    accent: "bg-emerald-500",
    headline: "Worth applying",
    blurb: "The evidence backs a confident apply.",
  },
  Borderline: {
    icon: MinusCircle,
    text: "text-amber-700 dark:text-amber-300",
    panel: "border-amber-500/30 bg-amber-500/10",
    accent: "bg-amber-500",
    headline: "Borderline",
    blurb: "Genuinely close — your call.",
  },
  No: {
    icon: ThumbsDown,
    text: "text-rose-700 dark:text-rose-300",
    panel: "border-rose-500/30 bg-rose-500/10",
    accent: "bg-rose-500",
    headline: "Weak match",
    blurb:
      "Several required levels are below the stated bar or not established from the CV. Review the gaps before deciding whether to apply.",
  },
} as const

// Reframed from an authoritative "SHOULD YOU APPLY? NO" into an explained outlook.
// The copy is curated per verdict (consistent between runs, concise, non-judgmental)
// rather than surfacing unconstrained model reasoning as the headline — the specifics
// live just below in Requirement Assessment. `shouldApply.reasoning` is preserved in the
// payload for future detail/debugging but is deliberately not the headline UX. It's Jev's
// independent call and doesn't consume satisfaction.
function OutlookBanner({ apply }: { apply: MatchAnalysis["shouldApply"] }) {
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
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Application outlook</p>
          <div className="flex items-center gap-3">
            <span className={cn("text-2xl font-bold tracking-tight sm:text-3xl", meta.text)}>{meta.headline}</span>
            <SourceBadge source={apply.source} />
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 sm:border-l sm:border-foreground/10 sm:pl-5">
        <p className="text-sm leading-relaxed text-foreground/80">{meta.blurb}</p>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          Jev’s call · {apply.confidence}% confidence · a suggestion, not a gate.
        </p>
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
  { status: "demonstrated", text: "directly evidenced" },
  { status: "inferred", text: "implied by a related capability" },
  { status: "unverified", text: "related capability, this one unconfirmed" },
  { status: "missing", text: "not evidenced in the CV" },
]

// ── Requirement Assessment panel ──────────────────────────────────────────────
// The centerpiece of the satisfaction lens: only the requirements where the JD stated
// an explicit bar (years / CEFR / experience-depth). This is where "has the skill" and
// "meets the required level" visibly diverge.
// One requirement row: satisfaction verdict + the evidence status kept visible beside
// it (so "has the skill" and "meets the level" stay legible together) + required vs CV.
function RequirementRow({ s, i }: { s: MatchAnalysis["skills"][number]; i: number }) {
  const sat = s.satisfaction as Satisfaction
  const meta = SAT_META[sat]
  const Icon = meta.icon
  const req = s.requiredLevel as RequiredLevel
  const evMeta = STATUS_META[s.status]
  const note = satNote(req, sat, s.status)
  const cv = cvSide(s)
  // When a required capability isn't demonstrated at all, the evidence lens is the real
  // story; keep the satisfaction pill as muted context so the row isn't two red failures.
  const isNotDemonstrated = s.status === "missing" && sat === "insufficient"
  return (
    <div
      className="animate-reveal rounded-lg border bg-card px-3 py-2.5"
      style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", meta.iconClass)} />
          <span className="truncate text-sm font-medium">{s.name}</span>
          <span className={cn("shrink-0 text-[10px]", evMeta.textClass)} title="Evidence status">
            · {evMeta.label}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums",
            isNotDemonstrated ? CHIP_MUTED : meta.chip,
          )}
        >
          {meta.label}
          {typeof s.satisfactionConfidence === "number" && (
            <span className="opacity-70"> {s.satisfactionConfidence}%</span>
          )}
        </span>
      </div>
      <div className="mt-1.5 grid gap-0.5 pl-6 text-xs text-muted-foreground">
        <div>
          Required: <span className="font-medium text-foreground/80">{formatRequired(req)}</span>
        </div>
        <div>
          {cv.label}: <span className="font-medium text-foreground/80">{cv.value}</span>
        </div>
        {note && <p className="mt-0.5 text-muted-foreground/80">{note}</p>}
      </div>
    </div>
  )
}

// Grouped so the eye lands on the three verdicts before individual skills.
const SAT_GROUPS: { sat: Satisfaction; heading: string }[] = [
  { sat: "satisfied", heading: "Satisfied" },
  { sat: "insufficient", heading: "Below requirement" },
  { sat: "unknown", heading: "Not established from the CV" },
]

function RequirementAssessment({ skills }: { skills: MatchAnalysis["skills"] }) {
  const rows = skills.filter((s) => s.requiredLevel && s.satisfaction)
  if (rows.length === 0) return null

  return (
    <Card>
      <CardContent className="pt-2">
        <div className="mb-1 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Requirement Assessment</p>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          Only requirements where the job description sets an explicit bar. <b>Satisfied</b> means the CV proves the
          required level; <b>Below requirement</b> means the CV establishes a lower level; <b>Not established</b> means
          the CV does not provide enough information to decide.
        </p>

        <div className="flex flex-col gap-4">
          {SAT_GROUPS.map(({ sat, heading }) => {
            const group = rows.filter((r) => r.satisfaction === sat)
            if (group.length === 0) return null
            const meta = SAT_META[sat]
            const Icon = meta.icon
            return (
              <div key={sat}>
                <div className="mb-2 flex items-center gap-1.5">
                  <Icon className={cn("h-4 w-4", meta.iconClass)} />
                  <span className={cn("text-xs font-semibold uppercase tracking-wide", meta.textClass)}>{heading}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">({group.length})</span>
                </div>
                <div className="grid gap-2">
                  {group.map((s, i) => (
                    <RequirementRow key={s.name} s={s} i={i} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ── CV Evidence (collapsed by default) ─────────────────────────────────────────
// The evidence-coverage lens: what relevant capabilities the CV can actually support,
// for every job-relevant skill. Progressive disclosure — the summary is always visible;
// the full per-skill grid expands on demand. No evidence is discarded. Server-rendered:
// only this markup reaches the client via CollapsibleCard, never the raw analysis object.
function CvEvidence({
  skills,
  routing,
}: {
  skills: MatchAnalysis["skills"]
  routing: MatchAnalysis["routing"]
}) {
  // Evidence-state tally — the prominent summary. Ordered, zero counts dropped.
  const order: SkillStatus[] = ["demonstrated", "inferred", "unverified", "missing"]
  const counts = order
    .map((status) => ({ status, n: skills.filter((s) => s.status === status).length }))
    .filter((c) => c.n > 0)

  const title = (
    <div className="flex items-center gap-2">
      <ListChecks className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">CV Evidence</span>
    </div>
  )
  const subtitle = (
    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
      Evidence found in the CV for all job-relevant skills and capabilities.
    </p>
  )
  const summary = (
    <>
      <p className="mt-3 text-sm font-medium text-foreground/90">
        {skills.length} relevant {skills.length === 1 ? "competency" : "competencies"} reviewed
      </p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
        {counts.map((c, idx) => {
          const meta = STATUS_META[c.status]
          return (
            <span key={c.status} className={cn("tabular-nums", meta.textClass)}>
              {c.n} {meta.label}
              {idx < counts.length - 1 && <span className="text-muted-foreground/40"> ·</span>}
            </span>
          )
        })}
      </p>
      {routing && (
        <p
          title="The router keeps confident calls on Jev and escalates only the uncertain ones to GPT."
          className="mt-1 text-[11px] tabular-nums text-muted-foreground/60"
        >
          ⚡ {routing.jevHandled} Jev · 🔍 {routing.escalated} GPT{" "}
          <span className="text-muted-foreground/40">of {routing.total}</span>
        </p>
      )}
    </>
  )

  return (
    <CollapsibleCard title={title} subtitle={subtitle} summary={summary}>
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
        {skills.map((s, i) => {
          const meta = STATUS_META[s.status]
          const Icon = meta.icon
          // "Not verified" is the status people misread: a related capability is
          // evidenced, but the required capability or level isn't confirmed.
          const statusNote =
            s.status === "unverified"
              ? "Related capability is evidenced, but the required capability or level is not verified from the CV."
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
                  {s.confidence}% {meta.label}
                </span>
              </div>
              {s.evidence && (
                <p className="mt-1.5 pl-6 text-xs italic leading-relaxed text-muted-foreground">“{s.evidence}”</p>
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
    </CollapsibleCard>
  )
}

export function ResultCard({ analysis }: { analysis: MatchAnalysis }) {
  const fit = band(analysis.fitLevel.score)
  const coverage = band(analysis.skillMatch.score)
  const keywords = band(analysis.keywordMatch.score)

  return (
    <div className="animate-reveal flex flex-col gap-4">
      {/* Summary strip */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Match Results</h2>
        <p className="text-pretty text-sm text-muted-foreground">{analysis.summary}</p>
      </div>

      {/* 1 — Application outlook (reframed: explained, not an authoritative verdict) */}
      <OutlookBanner apply={analysis.shouldApply} />

      {/* 2 — Three lenses on the same CV, on purpose */}
      <div>
        <p className="mb-2 text-sm font-medium">
          Three lenses on your fit <span className="font-normal text-muted-foreground">— they measure different things</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <LensCard
            icon={<Gauge className="h-4 w-4" />}
            title="Overall Fit"
            caption="Holistic suitability across the complete candidate-job match."
            score={analysis.fitLevel.score}
            label={fit.label}
            tone={fit.tone}
            confidence={analysis.fitLevel.confidence}
            primary
          />
          <LensCard
            icon={<ListChecks className="h-4 w-4" />}
            title="Skill Coverage"
            caption="Evidence that relevant skills and capabilities appear in the CV."
            score={analysis.skillMatch.score}
            label={coverage.label}
            tone={coverage.tone}
          />
          <LensCard
            icon={<KeyRound className="h-4 w-4" />}
            title="Keyword Overlap"
            caption="Literal overlap between CV and job-description terminology."
            score={analysis.keywordMatch.score}
            label={keywords.label}
            tone={keywords.tone}
            confidence={analysis.keywordMatch.confidence}
          />
        </div>
      </div>

      {/* 3 — Requirement assessment: has-the-skill vs meets-the-level */}
      <RequirementAssessment skills={analysis.skills ?? []} />

      {/* 4 — CV tone (secondary information) */}
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

      {/* 5 — CV evidence: the full evidence-coverage lens, collapsed by default */}
      {analysis.skills?.length > 0 && <CvEvidence skills={analysis.skills} routing={analysis.routing} />}
    </div>
  )
}
