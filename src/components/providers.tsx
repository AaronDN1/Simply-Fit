"use client";

import { MotionConfig } from "motion/react";
import { ToastProvider } from "./ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 34 }}>
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
