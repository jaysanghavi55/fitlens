import { MatchAnalyzer } from "@/components/match-analyzer"
import { ThemeToggle } from "@/components/theme-toggle"
import { Target } from "lucide-react"

export default function Page() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="animate-reveal mb-8 overflow-hidden rounded-2xl bg-linear-to-br from-brand to-brand-2 p-6 shadow-lg shadow-brand/20 ring-1 ring-white/10 sm:mb-10 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur">
              <Target className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                FitLens
              </h1>
              <p className="max-w-2xl text-pretty text-sm text-white/80 sm:text-base">
                Paste a job description and your CV to see how well you fit, whether you should apply, and how your
                keywords and tone stack up.
              </p>
              <p className="text-xs font-medium uppercase tracking-wide text-white/60">
                Powered by Jev · gpt-5-mini
              </p>
            </div>
          </div>
          <ThemeToggle className="shrink-0" />
        </div>
      </header>

      <MatchAnalyzer />
    </main>
  )
}
