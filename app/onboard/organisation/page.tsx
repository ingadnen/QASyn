import type { Metadata } from "next";
import { OrganisationForm } from "@/components/sections/onboard/OrganisationForm";

export const metadata: Metadata = { title: "Create organisation" };

/**
 * Cible C — /onboard/organisation
 * Volet gauche : formulaire (INSERT via POST /api/onboard, slug vérifié en temps réel).
 * Volet droit : aperçu "{Org} workspace" (layout.tsx) alimenté par OnboardingContext.
 */
export default function OrganisationPage() {
  return <OrganisationForm />;
}
