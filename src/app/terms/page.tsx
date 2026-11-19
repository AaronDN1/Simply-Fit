import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection, SupportEmail } from "@/components/legal/document";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of service"
      lede="These terms are a binding contract between you and Simply Fit. Creating an account requires you to check that you agree to them and to the privacy policy. If you do not agree, do not create an account."
    >
      <LegalSection title="The agreement">
        <p>
          These Terms of Service are a contract between you and the operator of Simply Fit (“Simply Fit,” “we,” “us”). The service is the Simply Fit website and app, including plans, logs, estimates, and any paid or complimentary access we offer later.
        </p>
        <p>
          The <Link href="/privacy" className="font-medium text-ink underline-offset-4 hover:underline">Privacy Policy</Link>, the{" "}
          <Link href="/medical" className="font-medium text-ink underline-offset-4 hover:underline">medical disclaimer</Link>, and the{" "}
          <Link href="/cookies" className="font-medium text-ink underline-offset-4 hover:underline">cookie notice</Link> are part of this contract. Checking the boxes on the account screen, or choosing “I agree” when the app asks again, is your electronic acceptance. We store the time and the version you accepted.
        </p>
        <p>You may use the service only if you agree to this entire contract. We may refuse an account.</p>
      </LegalSection>

      <LegalSection title="Who can agree">
        <p>
          You must be 16 or older. The app asks for your age before it saves a plan or health data, and it will refuse an age outside 16 to 90. You represent that the information you give is yours and is accurate, that you will keep it current, and that you are not barred from using the service.
        </p>
        <p>
          If you are under the age of majority where you live, you represent that a parent or guardian who is allowed to agree for you has reviewed these terms with you. Do not create an account or enter health information for a child.
        </p>
        <p>You are responsible for keeping your sign-in private and for activity on your account. Tell us at the support address if you believe someone else is using it.</p>
      </LegalSection>

      <LegalSection title="What Simply Fit is">
        <p>
          Simply Fit gives general fitness and nutrition guidance: a calorie and macro target, a training plan, and a place to log food, workouts, steps, sleep, and weight. It is not a physician, a dietitian, a physical therapist, an emergency service, or a medical device. Nothing in the service diagnoses, treats, cures, or prevents any disease.
        </p>
        <p>
          Targets, meal estimates, photos, voice notes, and workout drafts can be wrong. A photo can miss oil, sauce, and portion size. A workout suggestion is a general training idea, not rehab, and it is not a promise that an exercise is safe for your joints or your history. You review a meal before it is logged, and you review a workout before it replaces your split. You decide whether to follow any suggestion.
        </p>
        <p>
          Changing how you eat or train can injure you or make you ill. You assume that risk. Talk with a qualified professional before you change how you eat or train if you are pregnant, managing a medical condition, taking medication, or have a history of disordered eating. Stop if you feel unwell. If you have chest pain, fainting, trouble breathing, or any other urgent symptom, contact local emergency services. The support inbox cannot help in an emergency.
        </p>
        <p>
          When cloud AI is on, meal text, photos, voice notes, diet preferences, and allergies are sent to OpenAI to produce a reply, as the privacy policy describes. When it is off, those requests stay with the built-in estimator. AI output can be inaccurate, incomplete, or unsuitable. We do not guarantee that an AI feature will be available or that a reply is fit for a particular purpose.
        </p>
        <p>
          If Supabase is not configured, the app runs as a local demo and keeps data in that browser. The hosted app stores the account and logs with Supabase. Google processes sign-in if you choose Google. This website does not read Apple Health, Health Connect, or a smart scale.
        </p>
        <p>We may change, limit, or remove any feature, including plans, estimates, and AI tools. We do not promise uninterrupted, secure, or error-free operation.</p>
      </LegalSection>

      <LegalSection title="Accounts, plans, and fees">
        <p>
          An account is a personal, revocable permission to use Simply Fit. It is not property, and it is not a right you can sell or transfer. You may have one account for yourself. You may not share it or create an account for someone else.
        </p>
        <p>
          The service is offered without a paid subscription today. We may offer paid plans later. If we do, the price, the length, and whether it renews will be shown before you pay. Taxes that apply are yours. A fee is non-refundable except where a non-waivable law requires a refund, or where the purchase screen says otherwise.
        </p>
        <p>
          Complimentary access, a granted plan, a test account, staff access, or any other relationship with Simply Fit is also a permission we can take back. None of those create a right to keep the account, a feature, or a price.
        </p>
      </LegalSection>

      <LegalSection title="Suspension and termination">
        <p>
          We may refuse, suspend, disable, or permanently ban any account, and we may remove access to any feature or plan, at any time, for any reason or no reason, with or without notice, in our sole discretion.
        </p>
        <p>
          That right applies whether or not you have a free account, a paid subscription, a granted or complimentary plan, a refund pending, or any staff, tester, partner, affiliate, or other relationship with Simply Fit. It applies no matter how long you have used the service and no matter what we allowed before. A course of dealing does not limit this section.
        </p>
        <p>
          Ending access does not, by itself, obligate us to pay damages, keep your logs available, or continue a plan. Where a non-waivable law requires a refund of unused prepaid fees after we end a paid plan without your breach, that refund is the limit of what we owe for the ending. If we end access because you broke this contract, fees already paid are not refunded, except where the law says they must be.
        </p>
        <p>
          A disabled account cannot sign in. The export and delete controls in Settings are part of the signed-in app, so a ban can cut those off. Where the law still gives you a copy of your information or a right to deletion, write to <SupportEmail />. We may keep a disabled account and its data, delete them, or refuse a new account from you.
        </p>
        <p>You may stop using Simply Fit at any time. While your account is still open, Settings can export a copy, clear tracked logs, or delete the account. Deleting the hosted account removes the sign-in user, and the database is set up to delete that user’s rows with it.</p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You will not:</p>
        <p>
          break into another account or the service; probe, scan, or attack the app; overload it or go around a limit; use a bot or script to create accounts or pull data in bulk; reverse engineer the service except where a non-waivable law allows it; share your sign-in; impersonate another person; submit information you have no right to submit; or use the service, including the AI tools, for anything other than your own fitness and meal planning.
        </p>
        <p>
          You will not upload or request content that is unlawful, that infringes someone’s rights, or that is meant to harass, deceive, or harm. You will not use the service to generate medical instructions for someone else or to plan harm.
        </p>
        <p>We decide whether conduct breaks this section. The suspension and termination section still lets us end an account when there has been no violation.</p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          You keep the logs, photos, voice notes, and answers you submit. You give Simply Fit a non-exclusive license to host, copy, display, back up, and process that material only so we can operate, secure, and support the service, including sending it to the processors named in the privacy policy when that policy says we do. The license ends when the material is deleted from our systems, except for copies we are required to keep or that remain in ordinary backups until they age out.
        </p>
        <p>You represent that you have the rights you need to submit that material and that it does not violate this contract or anyone else’s rights.</p>
        <p>If you send us a suggestion about the product, we may use it without owing you a fee or a credit.</p>
      </LegalSection>

      <LegalSection title="Our property">
        <p>
          Simply Fit owns the service, its design, its text, its software, and its marks, other than your content. We give you a personal, non-exclusive, non-transferable, revocable license to use the service for your own fitness planning while your account is in good standing. You may not copy the product to build a competing service, and you may not remove credits or legal notices.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>
          The service is provided “as is” and “as available.” To the fullest extent the law allows, Simply Fit disclaims every warranty, express, implied, or statutory, including merchantability, fitness for a particular purpose, accuracy, quiet enjoyment, and non-infringement. We do not warrant that a target, estimate, or workout is correct, that you will lose fat, gain muscle, or reach a goal, or that the service will be uninterrupted or secure.
        </p>
        <p>Some places do not allow a particular disclaimer. In those places, the disclaimer applies to the fullest extent still allowed.</p>
      </LegalSection>

      <LegalSection title="Limit of liability">
        <p>
          To the fullest extent the law allows, Simply Fit and its operators, contractors, and suppliers will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, lost goodwill, or a training or nutrition outcome, even if we were told that kind of loss was possible.
        </p>
        <p>
          To the fullest extent the law allows, our total liability for a claim arising out of the service or these terms is limited to the greater of the amount you paid Simply Fit for the service in the twelve months before the claim, or one hundred U.S. dollars (US$100).
        </p>
        <p>
          These limits do not apply to liability that a law says cannot be limited, including fraud, or death or personal injury caused by gross negligence where a waiver of that liability is forbidden. They are otherwise a fundamental part of the bargain. The service is made available on these limits.
        </p>
        <p>Where the law allows, you must bring a claim within one year after it arose, or the claim is barred.</p>
      </LegalSection>

      <LegalSection title="Your indemnity">
        <p>
          You will defend, indemnify, and hold harmless Simply Fit and its operators, contractors, and suppliers from claims, damages, losses, and reasonable legal fees arising out of your content, your use of the service, your breach of this contract, or your violation of someone else’s rights, except to the extent a court finds the claim was caused by our gross negligence or willful misconduct.
        </p>
      </LegalSection>

      <LegalSection title="Disputes">
        <p>
          Before you file a claim, write to <SupportEmail /> and describe the dispute. We will try to resolve it informally for 30 days after we receive that notice, unless waiting would let a limitation period expire.
        </p>
        <p>
          These terms are governed by the laws of the United States and of the state where the operator of Simply Fit resides, without regard to conflict-of-law rules. You agree that the state and federal courts in that state are the forum, and you consent to personal jurisdiction there. If a non-waivable consumer law where you live requires a different forum or preserves a right this contract would otherwise limit, that law controls only that point.
        </p>
        <p>
          Where the law allows, you and Simply Fit waive a jury trial, and you agree to bring a claim only on an individual basis, not as a plaintiff or class member in a class, collective, or representative action. If a waiver in this paragraph is held unenforceable for a particular claim, that claim proceeds only to the extent required, and the rest of this contract stays in force. Either of us may still use small-claims court for a claim that qualifies.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update these terms. The date at the top is the current version. If the change needs a new agreement, the app will ask you to accept the new terms and the privacy policy before you continue. If you do not accept, you must stop using the service. While the account is still open you may delete it from Settings.
        </p>
      </LegalSection>

      <LegalSection title="Other terms">
        <p>
          This contract, including the privacy policy, medical disclaimer, and cookie notice, is the entire agreement about the service. It replaces earlier terms. If a provision is held unenforceable, it is modified to the minimum extent required, and the rest remains in effect. A failure to enforce a provision is not a waiver. We may assign this contract. You may not assign it without our consent. There are no third-party beneficiaries. Using the service does not create a partnership, employment, or agency.
        </p>
        <p>
          We are not liable for a delay or failure caused by something beyond our reasonable control, including a host, network, or supplier outage. Notices under this contract may be sent to the email on your account or shown in the app. Questions about these terms go to <SupportEmail />.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
