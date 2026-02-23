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

  // New generic polymorphic approach
  const { data, error } = await adminClient
    .from("activities")
    .select(`
      *,
      activity_participants_v2 (
        id,
        participant_type,
        participant_id,
        role,
        rsvp_status
      )
    `)
    .eq("tenant_id", parsed.data.tenantId)
    .eq("entity_type", parsed.data.entityType)
    .eq("entity_id", parsed.data.entityId)
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);

  if (error) {
    console.error("fetchActivities error:", error);
    return { error: "Failed to fetch activities" };
  }

  return { success: true, data };
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
    console.error("DEBUG Activity Validation Error:", parsed.error);
    return { error: `Invalid input: ${(parsed.error as any).errors[0].message}` };
  }

  const { tenantId, entityId, entityType, activityType, title, description, subject, body, isTask, dueAt, priority, participants } = parsed.data;

  const auth = await verifyAuthWithTenant(tenantId);
  if (isAuthError(auth)) {
    return { error: "Unauthorized for this tenant" };
  }
  const userId = auth.userId;

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
      entity_type: entityType || null,
      entity_id: entityId || null,
      created_by: userId,
      assigned_to: userId,
      commission_eligible: false,
    })
    .select("id")
    .single();

  if (activityError || !newActivity) {
    console.error("Failed to create activity", activityError);
    return { error: "Failed to create activity" };
  }

  // Insert participants if any (plus default owner/initiator)
  const inserts = [];

  // 1. Always add the creator as initiator
  inserts.push({
    tenant_id: tenantId,
    activity_id: newActivity.id,
    participant_type: "user",
    participant_id: userId,
    role: "initiator",
    rsvp_status: "accepted"
  });

  // 2. Add other participants
  if (participants && participants.length > 0) {
    for (const p of participants) {
      if (!(p.id === userId && p.role === "initiator")) { // avoid dupe
        inserts.push({
          tenant_id: tenantId,
          activity_id: newActivity.id,
          participant_type: p.type === 'user' ? 'user' : 'contact',
          participant_id: p.id,
          role: p.role,
          rsvp_status: p.rsvpStatus || "pending"
        });
      }
    }
  }

  const { error: partError } = await adminClient
    .from("activity_participants_v2")
    .insert(inserts);

  if (partError) {
    console.error("Failed to add participants", partError);
    // Don't fail the whole action, but log it
  }

  return { success: true, activityId: newActivity.id };
}
