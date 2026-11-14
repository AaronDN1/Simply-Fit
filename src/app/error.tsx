"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[100svh] place-items-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-[36px] leading-tight">Something went wrong</h1>
        <p className="mt-2 text-[15px] text-muted">This screen hit an error. Your account data is unchanged. Try the page again.</p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
