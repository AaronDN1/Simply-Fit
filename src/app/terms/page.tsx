import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal/document";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of service" lede="These are the rules for using Simply Fit. Creating an account, or choosing “I agree” in the app, means you accept them.">
      <LegalSection title="Who can use Simply Fit">
        <p>You need to be 16 or older. The app asks for your age before it saves a plan or health data, and it will refuse an age outside 16 to 90. You are responsible for keeping your sign-in private and for the activity on your account.</p>
      </LegalSection>
      <LegalSection title="What the app is">
        <p>
          Simply Fit gives general fitness and nutrition guidance: a calorie and macro target, a training plan, and a place to log food, workouts, steps, sleep, and weight. Read the <Link href="/medical" className="font-medium text-ink underline-offset-4 hover:underline">medical disclaimer</Link>. The app is not a doctor, a dietitian, or an emergency service.
        </p>
        <p>Calorie estimates, photos, and workout drafts can be wrong. You review a meal before it is logged, and you review a workout before it replaces your split. You decide whether to follow any suggestion.</p>
      </LegalSection>
      <LegalSection title="Your content">
        <p>
          You keep the logs and answers you enter. You let Simply Fit store and display them so the app can run, and you let it send meal text, photos, voice notes, diet preferences, and allergies to OpenAI when cloud AI is turned on in Settings. You can turn that off. You can export or delete your data from Settings.
        </p>
      </LegalSection>
      <LegalSection title="Acceptable use">
        <p>Don't misuse the service. That includes trying to break into someone else's account, attacking the app, or using the AI features to generate anything other than your own fitness and meal planning. We can suspend an account that abuses the service, including one that tries to overrun the AI limits.</p>
      </LegalSection>
      <LegalSection title="Availability and results">
        <p>
          The app is provided as it is available. We don't guarantee that it will be uninterrupted, that an estimate will be exact, or that you will lose fat, gain muscle, or reach a goal weight. Training and eating changes have real effects on your body. Stop and get medical help if you feel unwell.
        </p>
      </LegalSection>
      <LegalSection title="Liability">
        <p>
          To the extent the law allows, Simply Fit is not liable for indirect or consequential losses, or for decisions you make from its guidance. Nothing in these terms limits rights that consumer law says cannot be limited.
        </p>
      </LegalSection>
      <LegalSection title="Changes and ending use">
        <p>
          We may update these terms. If the change needs a new agreement, the app will ask you to accept the new version before you continue. You can stop using Simply Fit at any time and delete your account from Settings. Deleting the account removes the hosted account and its rows.
        </p>
        <p>These terms don't appoint a court. Mandatory rights where you live still apply. A public contact address is not offered in the app yet. Export and deletion are available in Settings.</p>
      </LegalSection>
    </LegalDocument>
  );
}
