"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verifyAuthWithTenant } from "./_shared/auth";
import { isAuthError } from "./_shared/auth-utils";

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
) {
  const parsed = FetchActivitiesSchema.safeParse({ tenantId, entityId, entityType, limit });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const auth = await verifyAuthWithTenant(parsed.data.tenantId);
  if (isAuthError(auth)) {
    return { error: "Unauthorized for this tenant" };
  }

  const adminClient = createAdminClient();

  // We fetch via activity_links
  const { data, error } = await adminClient
    .from("activity_links")
    .select(`
      activities (
        *
      )
    `)
    .eq("tenant_id", parsed.data.tenantId)
    .eq(`${parsed.data.entityType}_id`, parsed.data.entityId)
    .limit(parsed.data.limit);

  if (error) {
    console.error("fetchActivities error:", error);
    return { error: "Failed to fetch activities" };
  }

  const activitiesData = data.flatMap((d: any) => {
    const acts = d.activities;
    return Array.isArray(acts) ? acts : [acts];
  }).filter(Boolean);
  activitiesData.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return { success: true, data: activitiesData };
}

const CreateActivitySchema = z.object({
  tenantId: z.string().min(1),
  entityId: z.string().optional(),
  entityType: z.enum(["card", "opportunity", "lead"]).optional(),
  activityType: z.enum(["call", "email", "meeting", "note", "task", "sms", "whatsapp", "system"]),
  title: z.string().optional(),
  description: z.string().optional(),
  subject: z.string().optional(), // fallback for backwards compatibility
  body: z.string().optional(), // fallback for backwards compatibility
  isTask: z.boolean().optional().default(false),
  dueAt: z.string().optional(), // ISO string
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().default("normal"),
  participants: z.array(z.object({
    id: z.string(),
    type: z.enum(["user", "contact", "card", "lead"]),
    role: z.enum(['initiator', 'assignee', 'viewer', 'email_to', 'email_cc', 'email_bcc', 'required', 'optional']),
    rsvpStatus: z.string().optional()
  })).optional(),
});

export async function createActivity(data: z.infer<typeof CreateActivitySchema>) {
  const parsed = CreateActivitySchema.safeParse(data);
  if (!parsed.success) {
    return { error: `Invalid input: ${(parsed.error as any).errors[0].message}` };
  }

  const { tenantId, entityId, entityType, activityType, title, description, subject, body, isTask, dueAt, priority, participants } = parsed.data;

  const auth = await verifyAuthWithTenant(tenantId);
  if (isAuthError(auth)) {
    return { error: "Unauthorized for this tenant" };
  }
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

  // Insert the activity
  const { data: newActivity, error: activityError } = await adminClient
    .from("activities")
    .insert({
      tenant_id: tenantId,
      activity_type: activityType === 'task' ? 'task' : (activityType === 'meeting' ? 'meeting' : 'email'),
      subject: title || subject || "New Activity",
      body: description || body,
      due_at: dueAt || null,
      is_task: isTask,
      priority: priority || "normal",
      created_by: userId,
      assigned_to: assignee,
      commission_eligible: false,
    })
    .select("id")
    .single();

  if (activityError || !newActivity) {
    console.error("Failed to create activity", activityError);
    return { error: "Failed to create activity" };
  }

  // Insert link if any
  const inserts = [];

  if (entityId && entityType) {
    if (['card', 'opportunity', 'lead'].includes(entityType)) {
      const payload: any = {
        tenant_id: tenantId,
        activity_id: newActivity.id,
        link_type: 'related'
      };
      payload[`${entityType}_id`] = entityId;

      const { error: linkError } = await adminClient.from("activity_links").insert(payload);
      if (linkError) {
        console.error("Failed to link activity", linkError);
      }
    }
  }

  return { success: true, activityId: newActivity.id };
}
