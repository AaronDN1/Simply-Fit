import type { Metadata } from "next";
import { LegalDocument, LegalSection, SupportEmail } from "@/components/legal/document";

export const metadata: Metadata = { title: "Cookie notice" };

export default function CookiesPage() {
  return (
    <LegalDocument
      title="Cookie notice"
      lede="Simply Fit uses cookies only to keep you signed in. It does not use advertising cookies or analytics cookies."
    >
      <LegalSection title="Sign-in cookies">
        <p>
          When the hosted app is running, Supabase Auth sets cookies in your browser so the server knows which account is signed in. They are required for the account to work. “Remember me” keeps that sign-in on the device. If you leave it unchecked, the sign-in is meant to end when the browser session ends.
        </p>
        <p>These cookies are not used to follow you across other websites.</p>
      </LegalSection>
      <LegalSection title="What we don't set">
        <p>There is no advertising cookie, no third-party analytics cookie, and no cookie banner asking you to accept tracking. The product-analytics switch that used to appear in Settings did not record anything, and it has been removed.</p>
      </LegalSection>
      <LegalSection title="Local demo mode">
        <p>
          If Supabase is not configured, the app does not set auth cookies. Demo accounts and logs stay in this browser's local storage. Clearing site data for this site removes them.
        </p>
      </LegalSection>
      <LegalSection title="Questions">
        <p>
          Questions about these cookies go to <SupportEmail />.
        </p>
      </LegalSection>
      <LegalSection title="If this changes">
        <p>If Simply Fit later adds optional analytics, it will ask before setting anything that isn't required for sign-in, and this page will be updated.</p>
      </LegalSection>
    </LegalDocument>
  );
}
