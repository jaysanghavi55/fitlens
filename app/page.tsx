import { MatchAnalyzer } from "@/components/match-analyzer"
import { Target } from "lucide-react"

export default function Page() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-8 flex flex-col items-start gap-4 sm:mb-12">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Target className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Job Match Scorer</h1>
          <p className="max-w-2xl text-pretty text-muted-foreground">
            Paste a job description and your CV to see how well you fit, whether you should apply, and how your keywords
            and tone stack up.
          </p>
        </div>
      </header>

      <MatchAnalyzer />
    </main>
  )
}
