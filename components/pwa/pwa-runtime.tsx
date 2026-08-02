"use client";

import { useEffect } from "react";
import { initializePwa } from "@/lib/pwa";

export function PwaRuntime() {
  useEffect(() => {
    initializePwa();
  }, []);

  return null;
}
