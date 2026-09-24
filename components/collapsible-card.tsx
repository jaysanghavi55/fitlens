"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

// Progressive-disclosure card. Interactivity is isolated here so the parent can stay a
// server component — critically, only the already-rendered `summary`/`children` markup
// crosses the client boundary, never the raw analysis object (which carries eval-only
// telemetry that must never reach the page payload).
export function CollapsibleCard({
  title,
  subtitle,
  summary,
  children,
}: {
  title: React.ReactNode
  subtitle: React.ReactNode
  summary: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <CardContent className="pt-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            {title}
            {subtitle}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            {open ? "Hide details" : "Show all"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </span>
        </button>

        {/* Always visible */}
        {summary}

        {open && <div className="mt-4 border-t pt-4">{children}</div>}
      </CardContent>
    </Card>
  )
}
