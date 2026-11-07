/**
 * Contenu statique de la vitrine (marketing). Noms de clients et témoignages FICTIFS.
 * Les métriques Ship (72 / 94 / 68 / 43 %) et la grille tarifaire reprennent la structure observée.
 */

export const MARKETING_NAV = [
  { href: "/", label: "Home" },
  { href: "/ship", label: "Ship" },
  { href: "/integrations", label: "Integrations" },
  { href: "/learning", label: "Learning" },
  { href: "/dashboard/overview", label: "Dashboard" },
] as const;

export const KEY_METRICS = [
  { value: "72%", label: "of regressions caught before merge" },
  { value: "94%", label: "change-to-test coverage" },
  { value: "68%", label: "faster bug resolution" },
  { value: "43%", label: "lower cost of quality" },
] as const;

export const CUSTOMER_WORDMARKS = ["Acme", "Globex", "Initech", "Hooli", "Vandelay", "Umbrella", "Soylent", "Wonka Labs"];

export const TESTIMONIALS = [
  {
    quote: "Ship flagged the session regression on PR #1234 before anyone opened the diff. Our release reviews went from an hour to five minutes.",
    name: "Jordan Lee",
    role: "Head of QA, Acme (demo)",
  },
  {
    quote: "We plugged in GitHub and Jira on a Monday. By Friday, every production anomaly had a reproducible test attached.",
    name: "Priya Natarajan",
    role: "Engineering Manager, Globex (demo)",
  },
  {
    quote: "The localhost tunnel meant we could test our staging build without opening a single firewall port.",
    name: "Sam Okafor",
    role: "Staff Engineer, Initech (demo)",
  },
] as const;

export const CREDIT_PRICE_USD = 0.025;

export interface Plan {
  id: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
  name: string;
  price: number | null;
  period: string;
  credits: number | null;
  blurb: string;
  features: string[];
  cta: string;
}

export const PLANS: Plan[] = [
  {
    id: "FREE",
    name: "Free trial",
    price: 0,
    period: "15 days",
    credits: 3000,
    blurb: "Try Ship on one repository, no card required.",
    features: ["3,000 credits", "1 repository", "PR impact analysis", "Community support"],
    cta: "Start free",
  },
  {
    id: "STARTER",
    name: "Starter",
    price: 49,
    period: "per month",
    credits: 2000,
    blurb: "For small teams shipping weekly.",
    features: ["2,000 credits / month", "3 repositories", "Bug reproduction + RCA", "Slack alerts"],
    cta: "Choose Starter",
  },
  {
    id: "PRO",
    name: "Pro",
    price: 249,
    period: "per month",
    credits: 12000,
    blurb: "For product teams shipping every day.",
    features: ["12,000 credits / month", "Unlimited repositories", "Production signal replay", "Release Quality Reports", "Priority support"],
    cta: "Choose Pro",
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: null,
    period: "custom",
    credits: null,
    blurb: "SSO, private deployment and custom credit pools.",
    features: ["Custom credit volume", "SSO / SCIM", "Private tunnel relays", "Dedicated quality engineer"],
    cta: "Talk to sales",
  },
];

/** Coût en crédits par action (structure observée sur la page Ship). */
export const CREDIT_COSTS = [
  { action: "Test run", cost: "1 credit / 4 steps" },
  { action: "PR impact analysis", cost: "10 credits" },
  { action: "Bug analysis + RCA", cost: "15 credits" },
  { action: "Requirement upload", cost: "20 credits" },
  { action: "Ask a document", cost: "5 credits" },
  { action: "Browser recording", cost: "2 credits" },
  { action: "Site crawl", cost: "500 credits" },
  { action: "Full code analysis", cost: "1,000 credits" },
] as const;

export interface UsageEstimate {
  runs: number;
  steps: number;
  prs: number;
  bugs: number;
}

export function estimateCredits({ runs, steps, prs, bugs }: UsageEstimate): number {
  return runs * Math.ceil(Math.max(steps, 1) / 4) + prs * 10 + bugs * 15;
}

/** Plan le moins cher pour un volume donné (dépassement facturé au crédit). */
export function recommendPlan(credits: number): { plan: Plan; monthly: number | null } {
  const paid = PLANS.filter((p) => p.id === "STARTER" || p.id === "PRO").map((plan) => ({
    plan,
    monthly: (plan.price ?? 0) + Math.max(0, credits - (plan.credits ?? 0)) * CREDIT_PRICE_USD,
  }));
  const best = paid.reduce((a, b) => (b.monthly < a.monthly ? b : a));
  if (credits > 60_000) return { plan: PLANS.find((p) => p.id === "ENTERPRISE")!, monthly: null };
  return best;
}
