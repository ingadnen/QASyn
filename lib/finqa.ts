/**
 * Moteur de réponses simulé de FinQA (assistant flottant).
 * Pur (sans I/O) : le contexte est lu en base par /api/finqa puis passé ici.
 * Détection d'intention par mots-clés EN/FR — aucune requête vers un LLM externe.
 */
import { buildTunnelCommand } from "./tunnel";
import type { OsKey } from "./types";
import { formatUsdCompact } from "./utils";

export type FinqaLang = "en" | "fr";

export interface FinqaLink {
  label: string;
  href: string;
}

export interface FinqaReply {
  intent: string;
  text: string;
  code?: string;
  links?: FinqaLink[];
}

export interface FinqaContext {
  orgName: string | null;
  isDemo: boolean;
  latest: {
    release: number;
    version: string;
    title: string;
    prNumber: number | null;
    qualityScore: number;
    delta: number;
    coverage: number;
    costAvoided: number;
    regressionsCaught: number;
    testsPassed: number;
    testsTotal: number;
  } | null;
  totals: { runs: number; costAvoided: number; avgCoverage: number } | null;
  /** Données tunnel de l'organisation de session (jeton déjà masqué) */
  tunnel: { os: OsKey | null; port: number; maskedToken: string | null } | null;
}

/** Valeurs de repli (Release Quality Report #284) si la base est vide. */
const FALLBACK_LATEST: NonNullable<FinqaContext["latest"]> = {
  release: 284,
  version: "v2.8.1",
  title: "Fix checkout session handling",
  prNumber: 1234,
  qualityScore: 92,
  delta: 8,
  coverage: 94,
  costAvoided: 18_400,
  regressionsCaught: 3,
  testsPassed: 145,
  testsTotal: 148,
};

const FR_HINTS = /\b(quel|quelle|combien|comment|est|le|la|les|des|du|une|un|pour|qualit[ée]|couverture|co[uû]t|[ée]vit[ée]|installer|jeton|tarif|prix|bonjour|salut|merci|d[ée]mo)\b|[àâçéèêëîïôûù]/i;

export function detectLang(message: string): FinqaLang {
  return FR_HINTS.test(message) ? "fr" : "en";
}

const INTENTS: { intent: string; pattern: RegExp }[] = [
  { intent: "tunnel", pattern: /tunnel|localhost|local host|tnl_|token|jeton|install|powershell|\bport\b/i },
  { intent: "coverage", pattern: /coverage|couverture|covered/i },
  { intent: "cost", pattern: /cost|co[uû]t|saved|savings|avoid|[ée]vit|[ée]conomi|\$|money|argent/i },
  { intent: "pricing", pattern: /pric|tarif|prix|\bplans?\b|credit|crédit|cheap|\bcher\b/i },
  { intent: "quality", pattern: /quality|qualit|score|release|#?284|\bnote\b/i },
  { intent: "integrations", pattern: /integrat|github|gitlab|bitbucket|jira|linear|slack|connect/i },
  { intent: "contact", pattern: /demo|démo|contact|sales|commercial|talk|humain|human|team|équipe/i },
  { intent: "onboard", pattern: /start|sign ?up|onboard|create|commencer|cr[ée]er|inscri/i },
  { intent: "greeting", pattern: /^(hi|hello|hey|bonjour|salut|coucou)\b/i },
];

export function detectIntent(message: string): string {
  return INTENTS.find((i) => i.pattern.test(message))?.intent ?? "fallback";
}

function detectOs(message: string): OsKey | null {
  if (/windows|powershell|win\b/i.test(message)) return "WINDOWS";
  if (/mac|osx|zsh|darwin/i.test(message)) return "MACOS";
  if (/linux|ubuntu|debian|bash/i.test(message)) return "LINUX";
  return null;
}

const t = (lang: FinqaLang, en: string, fr: string) => (lang === "fr" ? fr : en);

export function answer(message: string, ctx: FinqaContext): FinqaReply {
  const lang = detectLang(message);
  const intent = detectIntent(message);
  const r = ctx.latest ?? FALLBACK_LATEST;
  const ws = ctx.orgName ? t(lang, `the ${ctx.orgName} workspace`, `l'espace ${ctx.orgName}`) : t(lang, "the demo workspace", "l'espace de démo");
  const demoNote = ctx.isDemo ? t(lang, " (demo data)", " (données de démo)") : "";
  const dashboard = { label: t(lang, "Open the dashboard", "Ouvrir le dashboard"), href: "/dashboard/overview" };

  switch (intent) {
    case "quality":
      return {
        intent,
        text: t(
          lang,
          `Release #${r.release} (${r.version}) scored ${r.qualityScore}/100 in ${ws}${demoNote} — ${r.delta >= 0 ? "↑" : "↓"} ${Math.abs(r.delta)} vs the previous release. Ship caught ${r.regressionsCaught} regression(s) before merge and ${r.testsPassed}/${r.testsTotal} tests passed.`,
          `La release #${r.release} (${r.version}) obtient ${r.qualityScore}/100 dans ${ws}${demoNote} — ${r.delta >= 0 ? "↑" : "↓"} ${Math.abs(r.delta)} par rapport à la précédente. Ship a intercepté ${r.regressionsCaught} régression(s) avant merge et ${r.testsPassed}/${r.testsTotal} tests sont passés.`,
        ),
        links: [dashboard],
      };
    case "coverage": {
      const avg = ctx.totals ? Math.round(ctx.totals.avgCoverage) : null;
      return {
        intent,
        text: t(
          lang,
          `Change-to-test coverage is ${r.coverage}% on release #${r.release}${avg !== null ? `, with a ${avg}% average over the last ${ctx.totals!.runs} runs` : ""}. Impacted flows without tests get new regression cases automatically.`,
          `La couverture change-to-test est de ${r.coverage} % sur la release #${r.release}${avg !== null ? `, avec une moyenne de ${avg} % sur les ${ctx.totals!.runs} derniers runs` : ""}. Les parcours impactés sans test reçoivent automatiquement de nouveaux cas de régression.`,
        ),
        links: [{ label: t(lang, "See the runs", "Voir les runs"), href: "/dashboard/overview#runs" }],
      };
    }
    case "cost": {
      const total = ctx.totals ? formatUsdCompact(ctx.totals.costAvoided) : null;
      return {
        intent,
        text: t(
          lang,
          `Release #${r.release} avoided ${formatUsdCompact(r.costAvoided)} in defect cost${total ? ` — ${total} across all ${ctx.totals!.runs} releases` : ""}. That's the estimated cost of the bugs Ship stopped before production.`,
          `La release #${r.release} a évité ${formatUsdCompact(r.costAvoided)} de coût de défaut${total ? ` — ${total} cumulés sur ${ctx.totals!.runs} releases` : ""}. C'est le coût estimé des bugs stoppés avant la production.`,
        ),
        links: [dashboard],
      };
    }
    case "tunnel": {
      const os = detectOs(message) ?? ctx.tunnel?.os ?? "LINUX";
      const port = ctx.tunnel?.port ?? 3000;
      const token = ctx.tunnel?.maskedToken ?? "tnl_<your-token>";
      return {
        intent,
        text: t(
          lang,
          `To test localhost, open onboarding step 2, choose “Localhost”, pick your OS tab and run the command below. The tunnel only opens an outbound connection authenticated by your tnl_ token${ctx.tunnel?.maskedToken ? " (masked here — reveal it in step 2)" : ""}. Then click “Check connection”.`,
          `Pour tester localhost, ouvrez l'étape 2 de l'onboarding, choisissez « Localhost », sélectionnez l'onglet de votre OS et lancez la commande ci-dessous. Le tunnel n'ouvre qu'une connexion sortante authentifiée par votre jeton tnl_${ctx.tunnel?.maskedToken ? " (masqué ici — affichez-le à l'étape 2)" : ""}. Cliquez ensuite sur « Check connection ».`,
        ),
        code: buildTunnelCommand(os, token, port),
        links: [{ label: t(lang, "Open step 2", "Ouvrir l'étape 2"), href: "/onboarding/2" }],
      };
    }
    case "pricing":
      return {
        intent,
        text: t(
          lang,
          "Plans: Free trial ($0, 15 days, 3,000 credits), Starter ($49/mo, 2,000 credits), Pro ($249/mo, 12,000 credits) and Enterprise (custom). A test run costs 1 credit per 4 steps; a PR analysis 10 credits.",
          "Offres : Free trial (0 $, 15 jours, 3 000 crédits), Starter (49 $/mois, 2 000 crédits), Pro (249 $/mois, 12 000 crédits) et Enterprise (sur mesure). Un run coûte 1 crédit pour 4 étapes ; une analyse de PR 10 crédits.",
        ),
        links: [{ label: t(lang, "Estimate my plan", "Estimer mon offre"), href: "/ship#pricing" }],
      };
    case "integrations":
      return {
        intent,
        text: t(
          lang,
          "GitHub and GitLab connect at onboarding step 3; Jira, Linear and Slack at step 4. Bitbucket, Jenkins, Teams and others are listed in the catalogue.",
          "GitHub et GitLab se connectent à l'étape 3 de l'onboarding ; Jira, Linear et Slack à l'étape 4. Bitbucket, Jenkins, Teams et d'autres figurent dans le catalogue.",
        ),
        links: [{ label: t(lang, "Browse integrations", "Voir les intégrations"), href: "/integrations" }],
      };
    case "contact":
      return {
        intent,
        text: t(
          lang,
          "Happy to connect you with the team! The fastest way to see QASyn on your own app is to create an organisation — a quality engineer will review your first run.",
          "Avec plaisir ! Le plus rapide pour voir QASyn sur votre application est de créer une organisation — un ingénieur qualité passera en revue votre premier run.",
        ),
        links: [{ label: t(lang, "Book a demo", "Réserver une démo"), href: "/onboard/organisation" }],
      };
    case "onboard":
      return {
        intent,
        text: t(
          lang,
          "Onboarding takes 7 short steps: describe your app, choose how Ship reaches it (team env or localhost), connect code, connect a tracker, pick a focus, invite your team and launch.",
          "L'onboarding tient en 7 étapes : décrire l'app, choisir comment Ship l'atteint (environnement d'équipe ou localhost), connecter le code, le tracker, choisir une priorité, inviter l'équipe et lancer.",
        ),
        links: [{ label: t(lang, "Start free", "Commencer"), href: "/onboard/organisation" }],
      };
    case "greeting":
      return {
        intent,
        text: t(
          lang,
          "Hi! Ask me about the quality score, coverage, cost avoided, pricing or how to install the localhost tunnel.",
          "Bonjour ! Posez-moi une question sur le score qualité, la couverture, le coût évité, les tarifs ou l'installation du tunnel localhost.",
        ),
      };
    default:
      return {
        intent: "fallback",
        text: t(
          lang,
          "I'm not sure about that one yet. I can answer questions on release quality, coverage, cost avoided, pricing, integrations and the localhost tunnel — or connect you with the team.",
          "Je n'ai pas encore la réponse. Je peux répondre sur la qualité des releases, la couverture, le coût évité, les tarifs, les intégrations et le tunnel localhost — ou vous mettre en relation avec l'équipe.",
        ),
        links: [{ label: t(lang, "Contact the team", "Contacter l'équipe"), href: "/onboard/organisation" }],
      };
  }
}
