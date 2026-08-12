"use client";

import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { authenticatedFetch } from "@/lib/auth-client";

type TutorialMode = "home" | "profile";
type TutorialStatus = { started: boolean; completed: boolean };
type TutorialStep = { eyebrow: string; title: string; description: string; targets: string[] };

const homeSteps: TutorialStep[] = [
  {
    eyebrow: "Step 1 of 4 · Your money at a glance",
    title: "See your total balance",
    description: "This is the combined balance across all of your accounts, so you always know where you stand.",
    targets: ["total-balance"],
  },
  {
    eyebrow: "Step 2 of 4 · Stay in motion",
    title: "Follow your activity",
    description: "Your latest transactions appear here. Use the highlighted add button to record an expense, income, or transfer whenever money moves.",
    targets: ["activity", "add-transaction"],
  },
  {
    eyebrow: "Step 3 of 4 · Understand the flow",
    title: "Income, expenses, and savings",
    description: "These cards summarize your money flow. Tap any card to open its detail view with charts, metrics, and related transactions.",
    targets: ["monthly-overview"],
  },
];

const profileStep: TutorialStep = {
  eyebrow: "Final step · Make it yours",
  title: "Your profile is your control center",
  description: "Update your name, currency, notifications, security, and app preferences here whenever you need to.",
  targets: ["profile-page"],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function AppTutorial({ mode }: { mode: TutorialMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isProfileRoute = mode === "profile" && searchParams.get("tutorial") === "final";
  const requestedHomeStep = mode === "home" && searchParams.get("tutorial") === "step3" ? 2 : 0;
  const steps = mode === "home" ? homeSteps : [profileStep];
  const [status, setStatus] = useState<TutorialStatus | null>(null);
  const [stepIndex, setStepIndex] = useState(mode === "profile" ? 0 : requestedHomeStep);
  const [rects, setRects] = useState<DOMRect[]>([]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);

  const routeEligible = mode === "home" || isProfileRoute;
  const activeStep = steps[stepIndex] ?? steps[0];

  useEffect(() => {
    if (!routeEligible) return;
    let active = true;
    void authenticatedFetch("/api/tutorial")
      .then(async (response) => {
        if (!response.ok) return;
        const result = (await response.json()) as { tutorial?: TutorialStatus };
        if (active) setStatus(result.tutorial ?? { started: false, completed: false });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [routeEligible]);

  useEffect(() => {
    if (!routeEligible || !status || status.completed) return;
    const measureTargets = () => {
      const nextRects = activeStep.targets.flatMap((target) => Array.from(document.querySelectorAll(`[data-tour="${target}"]`)).map((element) => element.getBoundingClientRect()));
      setRects(nextRects.filter((rect) => rect.width > 0 && rect.height > 0));
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    const frame = window.requestAnimationFrame(measureTargets);
    const retry = window.setTimeout(measureTargets, 180);
    window.addEventListener("resize", measureTargets);
    window.addEventListener("scroll", measureTargets, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
      window.removeEventListener("resize", measureTargets);
      window.removeEventListener("scroll", measureTargets, true);
    };
  }, [activeStep.targets, routeEligible, status]);

  const tooltip = useMemo(() => {
    if (!rects.length || !viewport.width || !viewport.height) return null;
    const bounds = rects.reduce((result, rect) => ({
      left: Math.min(result.left, rect.left),
      top: Math.min(result.top, rect.top),
      right: Math.max(result.right, rect.right),
      bottom: Math.max(result.bottom, rect.bottom),
    }), { left: viewport.width, top: viewport.height, right: 0, bottom: 0 });
    const width = Math.min(380, viewport.width - 32);
    const estimatedHeight = 238;
    const top = bounds.bottom + 18 + estimatedHeight <= viewport.height - 16
      ? bounds.bottom + 18
      : Math.max(16, bounds.top - estimatedHeight - 18);
    return { top, left: clamp(bounds.left, 16, viewport.width - width - 16), width };
  }, [rects, viewport]);

  if (!routeEligible || !status || status.completed) return null;
  if (mode === "home" && !status.started && requestedHomeStep === 0) {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/75 px-4" role="dialog" aria-modal="true" aria-labelledby="tutorial-welcome-title">
        <section className="tutorial-panel-enter w-full max-w-[390px] rounded-[22px] border border-white/15 bg-[#17302d] p-6 text-white shadow-[0_24px_80px_rgb(23_32_29_/_0.32)] sm:p-8">
          <div className="flex items-start justify-between gap-4"><span className="flex size-12 items-center justify-center rounded-[14px] bg-white/12 text-[#f6c86e]"><Sparkles aria-hidden="true" className="size-6" /></span><button type="button" disabled={pending} onClick={() => void completeTutorial()} className="text-xs font-semibold text-white/65 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white">Skip tour</button></div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-[#9de1c6]">A quick tour</p>
          <h1 id="tutorial-welcome-title" className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.05em]">Let’s make Luna feel familiar.</h1>
          <p className="mt-3 text-sm leading-6 text-white/72">We’ll point out the few places you’ll use most. You can move back and forward at any time.</p>
          <button type="button" disabled={pending} onClick={() => void startTutorial()} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#f6c86e] px-4 text-sm font-semibold text-[#17302d] transition-colors hover:bg-[#ffda8e] disabled:opacity-60">{pending ? "Starting…" : "Let’s begin"}<ArrowRight aria-hidden="true" className="size-4" /></button>
          {error ? <p role="alert" className="mt-3 text-center text-xs font-medium text-expense">{error}</p> : null}
        </section>
      </div>,
      document.body,
    );
  }
  if (!tooltip) return null;

  const maskId = `tutorial-mask-${mode}`;
  const isLastHomeStep = mode === "home" && stepIndex === homeSteps.length - 1;
  const isFinalStep = mode === "profile";

  async function startTutorial() {
    setPending(true);
    setError("");
    const response = await authenticatedFetch("/api/tutorial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) }).catch(() => null);
    if (!response?.ok) {
      setError("Could not start the tutorial. Please try again.");
      setPending(false);
      return;
    }
    setStatus((current) => ({ ...(current ?? { completed: false }), started: true }));
    setStepIndex(0);
    setPending(false);
  }

  async function completeTutorial() {
    setPending(true);
    setError("");
    const response = await authenticatedFetch("/api/tutorial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) }).catch(() => null);
    if (!response?.ok) {
      setError("Could not finish the tutorial. Please try again.");
      setPending(false);
      return;
    }
    setStatus((current) => ({ ...(current ?? { started: true }), completed: true }));
    router.replace("/");
  }

  function goBack() {
    setTransitionDirection(-1);
    if (isFinalStep) {
      router.push("/?tutorial=step3");
      return;
    }
    setStepIndex((current) => Math.max(0, current - 1));
  }

  function goNext() {
    setTransitionDirection(1);
    if (isLastHomeStep) {
      router.push("/profile?tutorial=final");
      return;
    }
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="tutorial-step-title">
      <svg className="pointer-events-none fixed inset-0 h-full w-full" viewBox={`0 0 ${viewport.width} ${viewport.height}`} aria-hidden="true">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={viewport.width} height={viewport.height}>
            <rect width={viewport.width} height={viewport.height} fill="white" />
            {rects.map((rect, index) => <motion.rect key={`${rect.left}-${rect.top}-${index}`} initial={{ opacity: 0 }} animate={{ opacity: 1, x: Math.max(0, rect.left - 8), y: Math.max(0, rect.top - 8), width: rect.width + 16, height: rect.height + 16 }} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }} rx="16" fill="black" />)}
          </mask>
        </defs>
        <rect width={viewport.width} height={viewport.height} fill="rgb(23 32 29 / 0.78)" mask={`url(#${maskId})`} />
        <g className="tutorial-spotlight-pulse" fill="none" stroke="#f6c86e" strokeWidth="2.5">
          {rects.map((rect, index) => <motion.rect key={`${rect.left}-${rect.top}-${index}`} initial={{ opacity: 0 }} animate={{ opacity: 1, x: Math.max(0, rect.left - 8), y: Math.max(0, rect.top - 8), width: rect.width + 16, height: rect.height + 16 }} transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }} rx="16" />)}
        </g>
      </svg>
      <AnimatePresence mode="wait" initial={false}>
        <motion.section layout key={`${mode}-${stepIndex}`} initial={{ opacity: 0, x: transitionDirection * 24, y: 8, scale: 0.97 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }} exit={{ opacity: 0, x: transitionDirection * -18, scale: 0.98 }} transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }} className="absolute rounded-[18px] border border-white/15 bg-[#17302d] p-5 text-white shadow-[0_18px_60px_rgb(23_32_29_/_0.25)]" style={{ top: tooltip.top, left: tooltip.left, width: tooltip.width }}>
        <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9de1c6]">{activeStep.eyebrow}</p><span className="text-xs font-medium text-white/55">{mode === "profile" ? "4 / 4" : `${stepIndex + 1} / 4`}</span></div>
        <div className="mt-2 flex items-start justify-between gap-3"><h2 id="tutorial-step-title" className="text-[22px] font-semibold leading-tight tracking-[-0.04em]">{activeStep.title}</h2><button type="button" disabled={pending} onClick={() => void completeTutorial()} className="shrink-0 pt-1 text-[11px] font-semibold text-white/60 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white">Skip</button></div>
        <p className="mt-2 text-sm leading-6 text-white/72">{activeStep.description}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          {stepIndex > 0 || isFinalStep ? <button type="button" disabled={pending} onClick={goBack} className="inline-flex min-h-10 items-center gap-1 rounded-[10px] px-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"><ArrowLeft aria-hidden="true" className="size-4" />Back</button> : <span />}
          <button type="button" disabled={pending} onClick={() => void (isFinalStep ? completeTutorial() : goNext())} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] bg-[#f6c86e] px-3.5 text-sm font-semibold text-[#17302d] transition-colors hover:bg-[#ffda8e] disabled:opacity-60">{isFinalStep ? (pending ? "Completing…" : "Complete") : isLastHomeStep ? "Open Profile" : "Next"}{isFinalStep ? <Check aria-hidden="true" className="size-4" /> : <ArrowRight aria-hidden="true" className="size-4" />}</button>
        </div>
        {error ? <p role="alert" className="mt-3 text-right text-xs font-medium text-[#ffb4a9]">{error}</p> : null}
        </motion.section>
      </AnimatePresence>
    </div>,
    document.body,
  );
}
