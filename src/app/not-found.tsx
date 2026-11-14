import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="grid min-h-[100svh] place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-8 font-display text-[40px] leading-tight">That page isn't here</h1>
        <p className="mt-2 text-[15px] text-muted">The link may be old, or the page may have moved.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-canvas">
          Back home
        </Link>
      </div>
    </div>
  );
}
