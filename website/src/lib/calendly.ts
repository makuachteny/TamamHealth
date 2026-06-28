export type CalendlyAvailableTime = {
  id: string;
  label: string;
  startTime: string;
  schedulingUrl?: string;
  source: "calendly" | "fallback";
};

type CalendlyAvailableTimeResponse = {
  collection?: Array<{
    status?: string;
    start_time?: string;
    scheduling_url?: string;
  }>;
};

type CalendlySchedulingLinkResponse = {
  resource?: {
    booking_url?: string;
    owner?: string;
  };
};

const CALENDLY_API_BASE = "https://api.calendly.com";
const CALENDLY_TIMEOUT_MS = 8000;

export function getCalendlyConfig() {
  const token = (process.env.CALENDLY_API_TOKEN || "").trim();
  const eventTypeUri = (process.env.CALENDLY_EVENT_TYPE_URI || "").trim();
  const fallbackUrl = (
    process.env.NEXT_PUBLIC_DEMO_SCHEDULING_URL ||
    process.env.NEXT_PUBLIC_CALENDLY_URL ||
    ""
  ).trim();

  return {
    token,
    eventTypeUri,
    fallbackUrl,
    configured: Boolean(token && eventTypeUri),
  };
}

export function getFallbackAvailability(timeZone = "America/New_York"): CalendlyAvailableTime[] {
  const labels = [
    "Mon, 10:00 AM",
    "Mon, 2:30 PM",
    "Tue, 11:00 AM",
    "Wed, 9:30 AM",
    "Wed, 3:00 PM",
    "Thu, 1:00 PM",
  ];

  return labels.map((label, index) => ({
    id: `fallback-${index}`,
    label: `${label} ${formatTimeZoneLabel(timeZone)}`,
    startTime: label,
    source: "fallback",
  }));
}

export async function fetchCalendlyAvailability(params: {
  timeZone?: string;
  days?: number;
  limit?: number;
}): Promise<CalendlyAvailableTime[]> {
  const { configured, eventTypeUri, token } = getCalendlyConfig();
  if (!configured) return getFallbackAvailability(params.timeZone);

  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000);
  const end = new Date(now.getTime() + (params.days ?? 14) * 24 * 60 * 60 * 1000);
  const url = new URL(`${CALENDLY_API_BASE}/event_type_available_times`);
  url.searchParams.set("event_type", eventTypeUri);
  url.searchParams.set("start_time", start.toISOString());
  url.searchParams.set("end_time", end.toISOString());

  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Calendly availability error ${response.status}: ${detail}`);
  }

  const body = (await response.json()) as CalendlyAvailableTimeResponse;
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: params.timeZone || "America/New_York",
  });

  return (body.collection || [])
    .filter((item) => item.status === "available" && item.start_time)
    .slice(0, params.limit ?? 6)
    .map((item, index) => ({
      id: item.start_time || `calendly-${index}`,
      label: formatter.format(new Date(item.start_time as string)),
      startTime: item.start_time as string,
      schedulingUrl: item.scheduling_url,
      source: "calendly",
    }));
}

export async function createCalendlySchedulingLink(): Promise<string> {
  const { configured, eventTypeUri, fallbackUrl, token } = getCalendlyConfig();
  if (!configured) return fallbackUrl;

  const response = await fetchWithTimeout(`${CALENDLY_API_BASE}/scheduling_links`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      max_event_count: 1,
      owner: eventTypeUri,
      owner_type: "EventType",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Calendly scheduling link error ${response.status}: ${detail}`);
  }

  const body = (await response.json()) as CalendlySchedulingLinkResponse;
  return body.resource?.booking_url || fallbackUrl;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALENDLY_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function formatTimeZoneLabel(timeZone: string) {
  if (!timeZone) return "";
  return timeZone.replace(/_/g, " ").split("/").pop() || timeZone;
}
