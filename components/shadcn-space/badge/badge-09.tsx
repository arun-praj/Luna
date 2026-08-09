'use client'

import { motion, type Variants } from "motion/react"
import { CircleAlert, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const LETTER_VARIANTS: Variants = {
  hidden: { y: -10, opacity: 0 },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: {
      delay: i * 0.025,
      duration: 0.28,
      ease: [0.215, 0.61, 0.355, 1],
    },
  }),
}

const MotionBadge = motion.create(Badge)

export function BudgetStatusBadge({ tone, label, ariaLabel, className }: {
  tone: "warning" | "danger"
  label: string
  ariaLabel?: string
  className?: string
}) {
  const danger = tone === "danger"
  const Icon = danger ? XCircle : CircleAlert
  const glow = danger ? "rgba(239,68,68,0.92)" : "rgba(245,158,11,0.92)"

  return (
    <MotionBadge
      aria-label={ariaLabel ?? label}
      variant="outline"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative z-10 h-4 max-w-[52px] cursor-default gap-0.5 overflow-visible rounded-full px-1.5 py-0",
        "bg-background text-[9px] font-semibold leading-none shadow-[0_2px_8px_rgb(23_32_29_/_0.16)] backdrop-blur-md",
        danger ? "border-red-500/30 text-red-600" : "border-amber-500/35 text-amber-700",
        className,
      )}
    >
      <motion.span
        aria-hidden
        animate={{ opacity: 0.5 }}
        transition={{ duration: 0.4 }}
        className="pointer-events-none absolute -top-1.5 left-[14%] right-[14%] h-2.5 blur-sm"
        style={{ background: `radial-gradient(ellipse 80% 100% at 50% 100%, ${glow} 0%, transparent 70%)` }}
      />
      <motion.span
        initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.28, ease: [0.175, 0.885, 0.32, 1.275] }}
        className="flex size-2.5 shrink-0 items-center justify-center"
      >
        <Icon aria-hidden size={10} strokeWidth={2.25} />
      </motion.span>
      <span aria-hidden="true" className="inline-flex min-w-0 overflow-hidden leading-none">
        {label.split("").map((char, index) => (
          <motion.span
            key={`${char}-${index}`}
            custom={index}
            variants={LETTER_VARIANTS}
            initial="hidden"
            animate="visible"
            className="inline-block whitespace-pre"
          >
            {char}
          </motion.span>
        ))}
      </span>
    </MotionBadge>
  )
}

export default BudgetStatusBadge
