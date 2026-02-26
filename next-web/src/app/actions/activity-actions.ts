"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";
import { ActionResult, actionSuccess, actionError } from "@/lib/action-result";

const FetchActivitiesSchema = z.object({
  tenantId: z.string().min(1),
  entityId: z.string().min(1),
  entityType: z.enum(["card", "opportunity", "lead"]),
  limit: z.number().min(1).max(100).optional().default(20),
});

export async function fetchActivities(
  tenantId: string,
  entityId: string,
  entityType: "card" | "opportunity" | "lead",
  limit: number = 20
): Promise<ActionResult<any[]>> {
  const parsed = FetchActivitiesSchema.safeParse({ tenantId, entityId, entityType, limit });
  if (!parsed.success) {
    return actionError("Invalid input", "VALIDATION_ERROR");
  }

  const auth = await verifyAuthWithTenant(parsed.data.tenantId);
  if (isAuthError(auth)) return actionError(auth.error, "AUTH_ERROR");

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("activities")
    .select(`*`)
    .eq("tenant_id", parsed.data.tenantId)
    .eq("entity_type", parsed.data.entityType)
    .eq("entity_id", parsed.data.entityId)
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);

  if (error) {
    console.error("fetchActivities error:", error);
    return actionError("Failed to fetch activities", "DB_ERROR");
  }

  return actionSuccess(data || []);
}

const CreateActivitySchema = z.object({
  tenantId: z.string().min(1),
  entityId: z.string().optional(),
  entityType: z.enum(["card", "opportunity", "lead"]).optional(),
  activityType: z.enum(["call", "email", "meeting", "note", "task", "sms", "whatsapp", "system"]),
  title: z.string().optional(),
  description: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  isTask: z.boolean().optional().default(false),
  dueAt: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
  participants: z.array(z.object({
    id: z.string(),
    type: z.enum(["user", "contact", "card", "lead"]),
    role: z.enum(['initiator', 'assignee', 'viewer', 'email_to', 'email_cc', 'email_bcc', 'required', 'optional']),
    rsvpStatus: z.string().optional()
  })).optional(),
});

export async function createActivity(data: z.infer<typeof CreateActivitySchema>): Promise<ActionResult<{ activityId: string }>> {
  const parsed = CreateActivitySchema.safeParse(data);
  if (!parsed.success) {
    return actionError(`Invalid input: ${parsed.error.issues[0].message}`, "VALIDATION_ERROR");
  }

  const { tenantId, entityId, entityType, activityType, title, description, subject, body, dueAt, priority, participants } = parsed.data;

  const auth = await verifyAuthWithTenant(tenantId);
  if (isAuthError(auth)) return actionError(auth.error, "AUTH_ERROR");
  const userId = auth.userId;

  // Determine assignee
  let assignee = userId;
  if (participants && participants.length > 0) {
    const pAssignee = participants.find(p => p.role === "assignee");
    if (pAssignee && pAssignee.type === "user") {
      assignee = pAssignee.id;
    }
  }

  const adminClient = createAdminClient();

  const payload: Record<string, unknown> = {
    tenant_id: tenantId,
    type: activityType === 'task' ? 'task' : (activityType === 'meeting' ? 'meeting' : 'email'),
    title: title || subject || "New Activity",
    description: description || body,
    due_date: dueAt || null,
    priority: priority || "normal",
    created_by: userId,
    assigned_to: assignee,
  };

  // Attach polymorphic link if provided
  if (entityId && entityType && ['card', 'opportunity', 'lead'].includes(entityType)) {
    payload.entity_type = entityType;
    payload.entity_id = entityId;
  }

  const { data: newActivity, error: activityError } = await adminClient
    .from("activities")
    .insert(payload)
    .select("id")
    .single();

  if (activityError || !newActivity) {
    console.error("Failed to create activity", activityError);
    return actionError("Failed to create activity: " + activityError?.message, "DB_ERROR");
  }

  return actionSuccess({ activityId: newActivity.id });
}
