import { z } from "zod";
import { APP_DESCRIPTION_MAX, APP_DESCRIPTION_MIN } from "./constants";
import { FOCUS_KEYS, OS_KEYS, PROVIDERS, REACH_TYPES } from "./types";
import { isEmail, normalizeWebsite } from "./utils";

/** URL http(s) normalisée, ou erreur de validation. */
const websiteField = (message: string) =>
  z
    .string()
    .max(300)
    .transform((value, ctx) => {
      const normalized = normalizeWebsite(value);
      if (!normalized) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message });
        return z.NEVER;
      }
      return normalized;
    });

/** POST /api/onboard */
export const createOrganisationSchema = z.object({
  ownerName: z.string().trim().min(2, "Enter your name.").max(80),
  name: z.string().trim().min(2, "Enter an organisation name.").max(60),
  slug: z.string().trim().toLowerCase().max(40).optional(),
  website: websiteField("Enter a valid company website (https://…)."),
  addWebsiteToKb: z.boolean().default(true),
});

/** PATCH /api/onboarding — une variante par étape */
export const stepPayloadSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal(1),
    appDescription: z
      .string()
      .trim()
      .min(APP_DESCRIPTION_MIN, `Write at least ${APP_DESCRIPTION_MIN} characters.`)
      .max(APP_DESCRIPTION_MAX, `Keep it under ${APP_DESCRIPTION_MAX} characters.`),
  }),
  z.object({
    step: z.literal(2),
    reachType: z.enum(REACH_TYPES),
    environmentUrl: z.string().max(300).optional(),
    selectedOs: z.enum(OS_KEYS).optional(),
    localPort: z.number().int().min(1).max(65535).optional(),
  }),
  z.object({ step: z.literal(3) }),
  z.object({ step: z.literal(4) }),
  z.object({ step: z.literal(5), focus: z.enum(FOCUS_KEYS) }),
  z.object({
    step: z.literal(6),
    teamInvites: z
      .array(z.string().trim().toLowerCase().refine(isEmail, "Invalid e-mail address."))
      .max(20, "Invite up to 20 teammates."),
  }),
  z.object({ step: z.literal(7) }),
]);
export type StepPayload = z.infer<typeof stepPayloadSchema>;

/** POST /api/onboarding/connection */
export const connectionCheckSchema = z.discriminatedUnion("reachType", [
  z.object({ reachType: z.literal("TEAM_ENV"), environmentUrl: z.string().max(300) }),
  z.object({ reachType: z.literal("LOCALHOST"), localPort: z.number().int().min(1).max(65535) }),
]);

/** POST /api/onboarding/integrations/[provider] */
export const providerSchema = z.enum(PROVIDERS);
export const integrationBodySchema = z.object({
  detail: z
    .string()
    .trim()
    .max(100)
    .regex(/^[\w.\-/# ]*$/, "Use letters, numbers, '-', '_', '.', '/' or '#'.")
    .optional(),
});
