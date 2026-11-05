import { redirect } from "next/navigation";

/** /onboard (ex. /onboard?mode=signup) → formulaire de création d'organisation */
export default function OnboardIndex() {
  redirect("/onboard/organisation");
}
