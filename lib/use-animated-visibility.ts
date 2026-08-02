import { useEffect, useState } from "react";

export function useAnimatedVisibility(open: boolean, duration = 320) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      const frame = window.requestAnimationFrame(() => {
        setMounted(true);
        setClosing(false);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (!mounted) return;
    const frame = window.requestAnimationFrame(() => setClosing(true));
    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, duration);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [duration, mounted, open]);

  return { mounted, closing };
}
