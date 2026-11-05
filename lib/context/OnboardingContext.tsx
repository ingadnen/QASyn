"use client";

import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { OnboardingState, OrganisationDraft } from "@/lib/types";

export const EMPTY_ONBOARDING_STATE: OnboardingState = {
  organisation: { id: null, name: "", slug: "", ownerName: "", website: "", addWebsiteToKb: true },
  currentStep: 1,
  appDescription: "",
  reachType: null,
  environmentUrl: "",
  selectedOs: null,
  localPort: 3000,
  tunnelToken: null,
  focus: null,
  teamInvites: [],
  integrations: [],
  completed: false,
};

type Action =
  | { type: "replace"; state: OnboardingState }
  | { type: "patch"; patch: Partial<OnboardingState> }
  | { type: "patchOrganisation"; patch: Partial<OrganisationDraft> };

function reducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case "replace":
      return action.state;
    case "patch":
      return { ...state, ...action.patch };
    case "patchOrganisation":
      return { ...state, organisation: { ...state.organisation, ...action.patch } };
  }
}

interface OnboardingContextValue {
  state: OnboardingState;
  /** Remplace tout l'état (ex. réponse serveur après sauvegarde) */
  replace: (state: OnboardingState) => void;
  /** Mise à jour locale (saisie en cours, non sauvegardée) */
  patch: (patch: Partial<OnboardingState>) => void;
  patchOrganisation: (patch: Partial<OrganisationDraft>) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/**
 * État global de l'onboarding : alimente en temps réel l'aperçu
 * "{Organisation} workspace" du volet droit.
 */
export function OnboardingProvider({
  initialState = EMPTY_ONBOARDING_STATE,
  children,
}: {
  initialState?: OnboardingState;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const replace = useCallback((next: OnboardingState) => dispatch({ type: "replace", state: next }), []);
  const patch = useCallback((p: Partial<OnboardingState>) => dispatch({ type: "patch", patch: p }), []);
  const patchOrganisation = useCallback(
    (p: Partial<OrganisationDraft>) => dispatch({ type: "patchOrganisation", patch: p }),
    [],
  );

  const value = useMemo(
    () => ({ state, replace, patch, patchOrganisation }),
    [state, replace, patch, patchOrganisation],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside <OnboardingProvider>.");
  return ctx;
}
