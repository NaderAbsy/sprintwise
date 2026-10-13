/** Whether a Jira message says the connection needs renewing, so a Reconnect button belongs next to it. */
export function needsReconnect(message: string | null | undefined): boolean {
  return Boolean(message && /connect jira (again|first)/i.test(message));
}
