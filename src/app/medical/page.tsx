import type { Metadata } from "next";
import { LegalDocument, LegalSection, SupportEmail } from "@/components/legal/document";

export const metadata: Metadata = { title: "Medical disclaimer" };

export default function MedicalPage() {
  return (
    <LegalDocument
      title="Medical disclaimer"
      lede="Simply Fit offers general fitness and nutrition guidance. It is not medical advice, and it is not a medical device."
    >
      <LegalSection title="Not a clinician">
        <p>
          Nothing in Simply Fit diagnoses, treats, cures, or prevents any disease. Targets for calories, protein, steps, cardio, and sleep are planning estimates based on the answers you give. They are not a prescription.
        </p>
        <p>
          Talk with a qualified professional before changing how you eat or train if you are pregnant, managing a medical condition, taking medication, or have a history of disordered eating. If you think you might have an eating disorder, get help from a clinician rather than using a calorie target.
        </p>
      </LegalSection>
      <LegalSection title="Emergencies">
        <p>Simply Fit cannot help in an emergency. If you have chest pain, fainting, trouble breathing, or any other urgent symptom, contact local emergency services.</p>
      </LegalSection>
      <LegalSection title="Estimates can be wrong">
        <p>
          Meal calories and macros are estimates, including when a photo or a description is sent to the AI. A photo can miss oil, sauce, and portion size. Workout suggestions are general training ideas, not rehab and not a guarantee that an exercise is safe for your joints or your history.
        </p>
        <p>Weight goes up and down from water, food, and sleep. The trend line is a view of the numbers you logged, not a clinical measurement.</p>
      </LegalSection>
      <LegalSection title="Questions about the app">
        <p>
          Questions about Simply Fit go to <SupportEmail />. That inbox is not a medical service and cannot help in an emergency.
        </p>
      </LegalSection>
      <LegalSection title="Your decision">
        <p>You decide what to eat, how to train, and whether a suggestion fits you. Stop an exercise that hurts, and don't keep a calorie target that leaves you unwell. The in-app check-in is a prompt to train easier or harder. It is not a diagnosis.</p>
      </LegalSection>
    </LegalDocument>
  );
}
