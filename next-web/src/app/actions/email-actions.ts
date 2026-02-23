"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { actionError, actionSuccess, ActionResult } from "@/lib/action-result";
import { Resend } from "resend";
import QuoteReadyEmail from "@/emails/QuoteReadyEmail";
import * as React from 'react';

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy_fallback_key_for_dev");

export async function sendQuoteEmail(input: {
    quoteId: string;
    tenantId: string;
}): Promise<ActionResult<{ messageId: string }>> {
    try {
        const { quoteId, tenantId } = input;

        if (!process.env.RESEND_API_KEY) {
            return actionError("RESEND_API_KEY is not configured.", "CONFIG_ERROR");
        }

        const adminClient = createAdminClient();

        // 1. Fetch Quote & Customer info
        const { data: quote, error: quoteError } = await adminClient
            .from("quotes")
            .select(`
                *,
                customer_id
            `)
            .eq("id", quoteId)
            .eq("tenant_id", tenantId)
            .single();

        if (quoteError || !quote) {
            console.error("[sendQuoteEmail] Quote not found:", quoteError);
            return actionError("Quote not found.", "NOT_FOUND");
        }

        // 2. We need customer info (email, name)
        // If customer_id is present, let's fetch from cards or people depending on schema.
        let customerEmail = "";
        let customerName = "Valued Customer";

        if (quote.customer_id) {
            // First try cards (if they are organizations or people cards)
            const { data: cardData } = await adminClient
                .from("cards")
                .select("email, display_name")
                .eq("id", quote.customer_id)
                .single();

            if (cardData) {
                if (cardData.email) customerEmail = cardData.email;
                if (cardData.display_name) customerName = cardData.display_name;
            } else {
                // Try People
                const { data: personData } = await adminClient
                    .from("people")
                    .select("email, first_name, last_name")
                    .eq("id", quote.customer_id)
                    .single();

                if (personData) {
                    if (personData.email) customerEmail = personData.email;
                    if (personData.first_name) customerName = `${personData.first_name} ${personData.last_name || ''}`.trim();
                }
            }
        }

        if (!customerEmail) {
            return actionError("Customer does not have an email address specified.", "VALIDATION_ERROR");
        }

        // Determine URL (Assuming host is env var or localhost fallback)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const quoteUrl = `${appUrl}/quote/${quote.public_token}/view`;

        // Formatting totals gracefully
        const totalAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency || 'ILS' }).format(quote.grand_total);

        // Find tenant organization name if possible (or default)
        let orgName = "NOW System";
        const { data: tenantInfo } = await adminClient
            .from("tenants")
            .select("name")
            .eq("id", tenantId)
            .single();
        if (tenantInfo?.name) orgName = tenantInfo.name;

        // 3. Send the email using Resend
        const { data: emailData, error: emailError } = await resend.emails.send({
            from: `${orgName} <hello@resend.dev>`, // Must be a verified domain, setup dependent.
            to: [customerEmail],
            subject: `Your Quote ${quote.quote_number} is Ready`,
            react: QuoteReadyEmail({
                customerName: customerName,
                quoteNumber: quote.quote_number,
                totalAmount: totalAmount,
                quoteUrl: quoteUrl,
                organizationName: orgName
            }) as React.ReactElement,
        });

        if (emailError) {
            console.error("[sendQuoteEmail] Resend Error:", emailError);
            return actionError("Failed to send email via provider.", "SEND_ERROR");
        }

        return actionSuccess({ messageId: emailData?.id || 'unknown' });

    } catch (err: any) {
        console.error("[sendQuoteEmail] Unexpected error:", err);
        return actionError("Internal error sending quote email.", "UNKNOWN");
    }
}
