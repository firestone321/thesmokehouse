import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";

export type OperationalIncidentSeverity = "warning" | "critical";

type OperationalIncidentInput = {
  type: string;
  severity: OperationalIncidentSeverity;
  source: string;
  message: string;
  orderId?: number | string | null;
  dedupeKey: string;
  context?: Record<string, unknown>;
};

function normalizeOrderId(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildIncidentDetail(input: OperationalIncidentInput) {
  const context = input.context ? JSON.stringify(input.context) : null;
  return [
    `type=${input.type}`,
    `source=${input.source}`,
    `dedupeKey=${input.dedupeKey}`,
    context ? `context=${context}` : null
  ]
    .filter((part): part is string => Boolean(part))
    .join(" | ");
}

export async function reportOperationalIncident(input: OperationalIncidentInput): Promise<string> {
  const supabase = getSupabaseAdmin();
  const relatedOrderId = normalizeOrderId(input.orderId);
  const title = input.message.trim();
  const detail = buildIncidentDetail(input);

  const existingQuery = supabase
    .from("ops_incidents")
    .select("id")
    .eq("status", "open")
    .eq("title", title)
    .eq("detail", detail)
    .eq("owner", "Payments")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: existing, error: existingError } =
    relatedOrderId === null
      ? await existingQuery.is("related_order_id", null).maybeSingle()
      : await existingQuery.eq("related_order_id", relatedOrderId).maybeSingle();

  if (existingError) {
    throw new Error(`Unable to check operational incidents: ${existingError.message}`);
  }

  if (existing?.id) {
    return String(existing.id);
  }

  const { data, error } = await supabase
    .from("ops_incidents")
    .insert({
      title,
      detail,
      severity: input.severity,
      owner: "Payments",
      related_order_id: relatedOrderId
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Unable to report operational incident: ${error.message}`);
  }

  return String(data.id);
}

export async function captureOperationalIncident(input: OperationalIncidentInput): Promise<void> {
  try {
    await reportOperationalIncident(input);
  } catch (error) {
    console.error("ops_incident_report_failed", {
      type: input.type,
      source: input.source,
      dedupeKey: input.dedupeKey,
      error: error instanceof Error ? error.message : "unknown_error"
    });
  }
}
