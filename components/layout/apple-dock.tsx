"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";
import { House, Target, UserRound, WalletCards, type LucideIcon } from "lucide-react";
import { useRef } from "react";

type DockItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
};

const dockItems: DockItem[] = [
  { href: "/", label: "Home", icon: House, iconClassName: "text-primary" },
  { href: "/accounts", label: "Accounts", icon: WalletCards, iconClassName: "text-info" },
  { href: "/goals", label: "Goals", icon: Target, iconClassName: "text-income" },
  { href: "/profile", label: "Profile", icon: UserRound, iconClassName: "text-expense" },
];

const dockRoutes = new Set(dockItems.map((item) => item.href));
const APPLE_DOCK_ENABLED = false;
const baseSize = 42;
const magnifiedSize = 62;
const magnificationDistance = 116;

function DockItem({ item, active, mouseX }: { item: DockItem; active: boolean; mouseX: MotionValue<number> }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const distance = useTransform(mouseX, (value) => {
    if (!Number.isFinite(value)) return magnificationDistance * 2;
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return magnificationDistance * 2;
    return value - (bounds.left + bounds.width / 2);
  });
  const targetSize = useTransform(
    distance,
    [-magnificationDistance, 0, magnificationDistance],
    [baseSize, magnifiedSize, baseSize],
  );
  const size = useSpring(targetSize, { mass: 0.12, stiffness: 170, damping: 14 });
  const Icon = item.icon;

  return (
    <motion.div style={{ width: size, height: size }} className="relative shrink-0">
      <Link
        ref={ref}
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        className={`group absolute inset-0 flex items-center justify-center rounded-[15px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 ${
          active
            ? "border-primary/20 bg-primary-soft shadow-[0_5px_14px_rgb(53_107_104_/_0.16)]"
            : "border-transparent bg-transparent hover:border-border hover:bg-card/75"
        }`}
      >
        <Icon aria-hidden="true" strokeWidth={active ? 2.35 : 2.1} className={`size-[21px] transition-transform group-hover:scale-105 ${item.iconClassName}`} />
        <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-foreground px-2 py-1 text-[10px] font-semibold text-background opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {item.label}
        </span>
        {active ? <span aria-hidden="true" className="absolute -bottom-1 size-1 rounded-full bg-primary" /> : null}
      </Link>
    </motion.div>
  );
}

function AppleDock({ activeHref }: { activeHref: string }) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);

  return (
    <motion.nav
      aria-label="Primary navigation"
      onMouseMove={(event) => mouseX.set(event.clientX)}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
      className="flex h-[62px] items-center justify-center gap-2 rounded-[20px] border border-border/80 bg-background/88 px-2.5 shadow-[0_12px_32px_rgb(23_32_29_/_0.16)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
    >
      {dockItems.map((item) => (
        <DockItem key={item.href} item={item} active={item.href === activeHref} mouseX={mouseX} />
      ))}
    </motion.nav>
  );
}

export function AppleDockNavigation() {
  const pathname = usePathname();
  const activeHref = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  if (!APPLE_DOCK_ENABLED || !dockRoutes.has(activeHref)) return null;

  return (
    <>
      {activeHref === "/" ? null : <div aria-hidden="true" className="h-[calc(5.5rem+env(safe-area-inset-bottom))] shrink-0" />}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto">
          <AppleDock activeHref={activeHref} />
        </div>
      </div>
    </>
  );
}
