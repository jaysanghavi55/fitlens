"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

// Dependency-free theme toggle. The class on <html> is the single source of truth;
// a blocking script in app/layout.tsx applies the stored choice before paint.
export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const stored = (() => {
      try {
        return localStorage.getItem("theme")
      } catch {
        return null
      }
    })()
    const dark = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches
    setIsDark(dark)
    // Normalise the class so it reflects the effective theme even when unset.
    root.classList.toggle("dark", dark)
    root.classList.toggle("light", !dark)
    setMounted(true)
  }, [])

  function toggle() {
    const next = !isDark
    const root = document.documentElement
    root.classList.toggle("dark", next)
    root.classList.toggle("light", !next)
    try {
      localStorage.setItem("theme", next ? "dark" : "light")
    } catch {
      /* ignore */
    }
    setIsDark(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white/90 backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
        className,
      )}
    >
      {/* Avoid a hydration mismatch: render nothing icon-wise until mounted. */}
      {mounted ? (
        isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
      ) : (
        <span className="h-4 w-4" />
      )}
    </button>
  )
}
