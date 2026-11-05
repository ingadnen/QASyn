import { cookies } from "next/headers";

/**
 * "Session" locale minimaliste : l'id de l'organisation courante est stocké
 * dans un cookie httpOnly (pas d'authentification réelle dans ce clone local).
 */
export const ORG_COOKIE = "qasyn_org";

export async function getCurrentOrgId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ORG_COOKIE)?.value ?? null;
}

/** À appeler uniquement depuis une Route Handler ou une Server Action. */
export async function setCurrentOrg(organisationId: string): Promise<void> {
  const store = await cookies();
  store.set(ORG_COOKIE, organisationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
