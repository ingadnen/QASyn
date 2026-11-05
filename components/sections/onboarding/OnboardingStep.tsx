"use client";

import { StepBugTracker } from "./StepBugTracker";
import { StepConnectCode } from "./StepConnectCode";
import { StepDescribe } from "./StepDescribe";
import { StepFocus } from "./StepFocus";
import { StepReach } from "./StepReach";
import { StepReview } from "./StepReview";
import { StepTeam } from "./StepTeam";

/** Gestionnaire séquentiel : rend le composant de l'étape demandée. */
export function OnboardingStep({ step }: { step: number }) {
  switch (step) {
    case 1:
      return <StepDescribe />;
    case 2:
      return <StepReach />;
    case 3:
      return <StepConnectCode />;
    case 4:
      return <StepBugTracker />;
    case 5:
      return <StepFocus />;
    case 6:
      return <StepTeam />;
    default:
      return <StepReview />;
  }
}
