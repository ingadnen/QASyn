/**
 * Notification dispatch: simulated Slack / Teams / email formatters and
 * event matching. Delivery is simulated (no outbound requests).
 */
export interface NotificationRuleLike {
  channel: string;
  events: string[];
  enabled: boolean;
}

export function matchesEvent(rules: NotificationRuleLike[], event: string): NotificationRuleLike[] {
  return rules.filter((r) => r.enabled && (r.events.includes(event) || r.events.includes("*")));
}

export function formatSlackMessage(event: string, title: string, detail: string): string {
  const blocks = [
    { type: "section", text: { type: "mrkdwn", text: `*QASyn — ${event}*` } },
    { type: "section", text: { type: "mrkdwn", text: `${title}\n${detail}` } },
  ];
  return JSON.stringify({ blocks, text: `QASyn ${event}: ${title}` });
}

export function formatEmail(event: string, title: string, detail: string): { subject: string; body: string } {
  return { subject: `[QASyn] ${event}: ${title}`, body: `${title}\n\n${detail}\n\nSent from QASyn.` };
}

export function formatTeamsMessage(event: string, title: string, detail: string): string {
  return JSON.stringify({ "@type": "MessageCard", "@context": "http://schema.org/extensions", themeColor: "5B4EE8", summary: `QASyn ${event}`, sections: [{ activityTitle: title, activitySubtitle: event, text: detail }] });
}
