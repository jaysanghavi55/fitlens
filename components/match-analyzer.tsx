"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { ResultCard } from "@/components/result-card"
import { cn } from "@/lib/utils"
import type { MatchAnalysis } from "@/lib/types"
import {
  Loader2,
  Sparkles,
  AlertCircle,
  Upload,
  ListChecks,
  Zap,
  FileSearch,
  CheckCircle2,
  Circle,
} from "lucide-react"

// Keep in sync with the guard in app/api/extract/route.ts.
const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB

// The real pipeline order, surfaced to the user. /api/analyze returns a single response
// (it doesn't stream stage events), so these advance on estimated timings while the one
// request is in flight — the last stage holds "in progress" until the result arrives.
const STAGES = [
  { icon: ListChecks, label: "Extracting required skills", detail: "gpt-5-mini reads the job description" },
  { icon: Zap, label: "Scoring fit with Jev", detail: "one batched decision call across every skill" },
  { icon: FileSearch, label: "Gathering evidence", detail: "quoting the CV & finalizing the verdict" },
] as const

function AnalysisProgress() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    // Walk forward on rough timings that mirror the pipeline; the final stage stays
    // active until the response lands and this component unmounts.
    const timers = [
      setTimeout(() => setActive(1), 3000),
      setTimeout(() => setActive(2), 8000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <Card className="animate-reveal">
      <CardContent className="flex flex-col gap-4 px-6 py-10">
        <p className="text-sm font-medium">Analyzing your match…</p>
        <ol className="flex flex-col gap-3">
          {STAGES.map((stage, i) => {
            const state = i < active ? "done" : i === active ? "active" : "pending"
            return (
              <li key={stage.label} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {state === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : state === "active" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/30" />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm leading-tight",
                      state === "pending"
                        ? "text-muted-foreground/50"
                        : state === "active"
                          ? "font-medium text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    {stage.label}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs leading-tight",
                      state === "pending" ? "text-muted-foreground/30" : "text-muted-foreground",
                    )}
                  >
                    {stage.detail}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

export function MatchAnalyzer() {
  const [jobDescription, setJobDescription] = useState("")
  const [resume, setResume] = useState("")
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAnalyze =
    jobDescription.trim().length >= 20 && resume.trim().length >= 20 && !isLoading && !isUploading

  async function handleAnalyze() {
    setIsLoading(true)
    setError(null)
    setAnalysis(null)
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, resume }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to analyze.")
      setAnalysis(data as MatchAnalysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is larger than 5 MB. Please upload a smaller PDF/DOCX or paste the text.")
      e.target.value = ""
      return
    }
    setIsUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/extract", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to read file.")
      setResume(data.text)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file.")
    } finally {
      setIsUploading(false)
      e.target.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="jobDescription">Job Description</Label>
              <Textarea
                id="jobDescription"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here…"
                className="min-h-56 resize-y leading-relaxed"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="resume">My CV / Resume</Label>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {isUploading ? "Reading…" : "Upload PDF / DOCX"}
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
              <Textarea
                id="resume"
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                placeholder="Paste your CV or resume here…"
                className="min-h-56 resize-y leading-relaxed"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Add at least 20 characters to each field. Text is sent to AI providers for analysis and isn&apos;t stored by this app.
            </p>
            <Button onClick={handleAnalyze} disabled={!canAnalyze} size="lg" className="sm:w-auto">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze Match
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {isLoading && <AnalysisProgress />}

      {analysis && !isLoading && <ResultCard analysis={analysis} />}
    </div>
  )
}
