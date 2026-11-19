import type { Metadata } from "next";
import { LegalDocument, LegalSection, SupportEmail } from "@/components/legal/document";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy policy"
      lede="This policy describes what Simply Fit stores, why, and who else processes it. It matches the app as it works today."
    >
      <LegalSection title="Who this applies to">
        <p>
          Simply Fit is a fitness and nutrition planning app. This policy covers the account, plan, and logs you create in the app. If Supabase is not configured, the app runs as a local demo and keeps that data in your browser instead of on a server.
        </p>
      </LegalSection>
      <LegalSection title="Information we collect">
        <p>Account details: email address, name, and sign-in method. Passwords are handled by Supabase Auth. Simply Fit does not keep a copy of your password. If you use Google, we receive the name and email Google shares for sign-in.</p>
        <p>
          Plan and body details you choose to enter: age, sex if you provide it, height, weight, goal, training habits, equipment, diet preferences, allergies, and the targets calculated from those answers.
        </p>
        <p>Logs you add: meals, workouts, cardio, steps, sleep, weight, and a short recovery check-in.</p>
        <p>
          When cloud AI is on, the text, photos, and voice notes you submit for a meal estimate or a workout draft are sent to OpenAI, along with your diet preferences and allergies. When cloud AI is off, those requests stay with the built-in estimator and are not sent to OpenAI.
        </p>
        <p>
          This website does not read Apple Health, Health Connect, or a smart scale. A future phone app could send steps, sleep, workouts, and weight that you explicitly allow. Until that app exists, those numbers are whatever you type in.
        </p>
      </LegalSection>
      <LegalSection title="How we use it">
        <p>We use this information to build and show your plan, keep your log, estimate meals, draft workouts, and remember your settings. We do not sell personal information, and the app does not run advertising or product-analytics cookies.</p>
        <p>The privacy switch in Settings controls cloud AI only. It does not turn off storage of the meals, workouts, and body details you save in Simply Fit.</p>
      </LegalSection>
      <LegalSection title="Who else processes it">
        <p>Supabase stores your account and data and provides sign-in. OpenAI processes meal and workout requests when cloud AI is on, to generate the reply. Google processes sign-in if you choose Google. Each company handles that data under its own terms. We use OpenAI through its API to answer your request, not to build Simply Fit's own training set.</p>
      </LegalSection>
      <LegalSection title="How long we keep it">
        <p>
          Data stays until you delete it. Settings can export a copy of your data or clear tracked logs. Deleting the account removes the sign-in user, and the database is set up to delete that user's rows with it. Local demo data stays in the browser until you clear the site data or delete the demo account. If the account is disabled, sign-in stops, including those Settings controls. Where the law still gives you a copy or deletion, write to the support address in the contact section. The terms of service explain when an account can be ended.
        </p>
      </LegalSection>
      <LegalSection title="Age">
        <p>Simply Fit is for people 16 and older. The app will not save a plan or health logs for an age under 16. Do not create an account or enter health information for a child.</p>
      </LegalSection>
      <LegalSection title="Security">
        <p>
          In the hosted app, each person's rows are protected by database rules that allow access only to that signed-in user. Traffic is encrypted in transit. No method of storage is perfect. Export or delete your account from Settings if you want your data out.
        </p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          Privacy questions, access requests, and anything else about your account go to <SupportEmail />. That is the support address and the main contact for Simply Fit.
        </p>
      </LegalSection>
      <LegalSection title="Changes">
        <p>If this policy changes in a way that needs a new agreement, the app will ask you to accept it again before you continue. The date at the top is the current version.</p>
      </LegalSection>
    </LegalDocument>
  );
}
