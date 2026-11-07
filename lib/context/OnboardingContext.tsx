"use client";

import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import type { OnboardingState, OrganisationDraft } from "@/lib/types";

export const EMPTY_ONBOARDING_STATE: OnboardingState = {
  organisation: { id: null, name: "", slug: "", ownerName: "", website: "", addToKnowledgeBase: true, logoUrl: null },
  currentStep: 1,
  appDescription: "",
  reachMode: null,
  environmentUrl: "",
  localPort: 3000,
  tunnelToken: null,
  tunnelEnrolled: false,
  appLoginType: null,
  appLoginUsername: "",
  hasAppLoginPassword: false,
  painPoints: [],
  userRole: null,
  testingMaturity: null,
  focusPriority: null,
  invitedEmails: [],
  integrations: [],
  completed: false,
  crawl: null,
  trialEndsAt: null,
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
  replace: (state: OnboardingState) => void;
  patch: (patch: Partial<OnboardingState>) => void;
  patchOrganisation: (patch: Partial<OrganisationDraft>) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Onboarding state: feeds the live "{Org} workspace" preview of the right panel. */
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
  const patchOrganisation = useCallback((p: Partial<OrganisationDraft>) => dispatch({ type: "patchOrganisation", patch: p }), []);
  const value = useMemo(() => ({ state, replace, patch, patchOrganisation }), [state, replace, patch, patchOrganisation]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside <OnboardingProvider>.");
  return ctx;
}
