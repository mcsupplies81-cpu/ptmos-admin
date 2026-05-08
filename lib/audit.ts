import type { SupabaseClient } from "@supabase/supabase-js";

type AuditDetails = Record<string, unknown> | null;

type LogAuditInput = {
  adminEmail?: string | null;
  action: string;
  targetType: "user" | "provider" | "feature_flag" | "announcement" | string;
  targetId?: string | null;
  details?: AuditDetails;
};

export async function logAudit(supabase: SupabaseClient, input: LogAuditInput) {
  const { error } = await supabase.from("audit_log").insert({
    admin_email: input.adminEmail ?? null,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    details: input.details ?? null,
  });

  if (error) {
    throw error;
  }
}
