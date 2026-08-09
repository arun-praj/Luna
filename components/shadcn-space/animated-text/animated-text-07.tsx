"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

type TextMorphProps = {
  words?: string[];
  interval?: number;
  className?: string;
  activeIndex?: number;
};

const defaultWords = ["blocks", "components", "templates"];

export function TextMorph({
  words = defaultWords,
  interval = 2500,
  className,
  activeIndex,
}: TextMorphProps) {
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
        key={currentIndex}
        className={cn("flex items-baseline gap-0.25 overflow-hidden", className)}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.4 }}
      >
        {chars.map((char, i) => (
          <motion.span
            key={`${currentIndex}-${i}`}
            className="inline-block"
            initial={{ opacity: 0, y: 5, filter: "blur(5px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -5, filter: "blur(5px)" }}
            transition={{
              delay: i * 0.03,
              duration: 0.3,
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
