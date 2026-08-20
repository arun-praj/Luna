"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type TextMorphProps = {
  words?: string[];
  interval?: number;
  className?: string;
  activeIndex?: number;
  animate?: boolean;
};

const defaultWords = ["blocks", "components", "templates"];

export function TextMorph({
  words = defaultWords,
  interval = 2500,
  className,
  activeIndex,
  animate = true,
}: TextMorphProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (activeIndex !== undefined || !words.length) return;

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, interval);

    return () => clearInterval(timer);
  }, [activeIndex, interval, words]);

  const currentIndex = activeIndex === undefined
    ? words.length ? index % words.length : 0
    : Math.max(0, Math.min(activeIndex, Math.max(0, words.length - 1)));
  const chars = useMemo(() => Array.from(words[currentIndex] ?? ""), [currentIndex, words]);

  if (!words.length) return null;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={`${currentIndex}:${words[currentIndex] ?? ""}`}
        className={cn("flex items-baseline gap-0.25 overflow-hidden", className)}
        initial={reduceMotion || !animate ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion || !animate ? undefined : { opacity: 0, y: -5 }}
        transition={reduceMotion || !animate ? { duration: 0 } : { duration: 0.4 }}
      >
        {chars.map((char, i) => (
          <motion.span
            key={`${currentIndex}:${words[currentIndex] ?? ""}-${i}`}
            className="inline-block"
            initial={reduceMotion || !animate ? false : { opacity: 0, y: 5, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduceMotion || !animate ? undefined : { opacity: 0, y: -5, filter: "blur(5px)" }}
            transition={{
              delay: reduceMotion || !animate ? 0 : i * 0.03,
              duration: reduceMotion || !animate ? 0 : 0.3,
            }}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </motion.span>
    </AnimatePresence>
  );
}

const TextMorphMotion = () => {
  return (
    <TextMorph
      words={["blocks", "components", "templates"]}
      className="text-xl text-primary sm:text-2xl"
    />
  );
};

export default TextMorphMotion;
