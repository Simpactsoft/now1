"use client";

import React, { useState } from "react";
import { acceptPublicQuote } from "@/app/actions/publicQuote";
import { CheckCircle2, Building2, User, Mail, Phone, CalendarCheck } from "lucide-react";

export default function PublicQuoteViewer({ quote, token, clientIp }: { quote: any, token: string, clientIp: string }) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAccepted, setIsAccepted] = useState(quote.status === "won");

    const handleAccept = async () => {
        setError(null);
        setSubmitting(true);
        const res = await acceptPublicQuote(token, clientIp);
        if (res.success) {
            setIsAccepted(true);
        } else {
            setError(res.error || "Failed to accept quote. Please try again.");
        }
        setSubmitting(false);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat(quote.locale || 'he-IL', {
            style: 'currency',
            currency: quote.currency || 'ILS'
        }).format(val || 0);
    };

    // Safely extract email and phone from contact_methods (JSONB array structure)
    let email = "N/A";
    let phone = "N/A";
    if (Array.isArray(quote.customer?.contact_methods)) {
        const emailContact = quote.customer.contact_methods.find((c: any) => c.type === 'email' || c.method === 'email');
        if (emailContact) email = emailContact.value;

        const phoneContact = quote.customer.contact_methods.find((c: any) => c.type === 'phone' || c.method === 'phone');
        if (phoneContact) phone = phoneContact.value;
    }

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Header: Company & Quote Info */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center border border-brand-primary/20">
                        <Building2 size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">{quote.tenant?.name || "Company Name"}</h1>
                        <p className="text-slate-500 font-medium">Quote #{quote.order_number}</p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 text-end">
                    <div className="px-4 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-bold uppercase tracking-wider">
                        {isAccepted ? (
                            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={16} /> Accepted</span>
                        ) : (
                            <span>{quote.status || "Draft"}</span>
                        )}
                    </div>
                    <p className="text-slate-400 text-sm">Issued: {new Date(quote.created_at).toLocaleDateString('en-GB')}</p>
                    {quote.valid_until && (
                        <p className="text-slate-400 text-sm">Valid Until: {new Date(quote.valid_until).toLocaleDateString('en-GB')}</p>
                    )}
                </div>
            </div>

            {/* Customer Details */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <User className="text-brand-primary" size={20} />
                    Prepared For
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Customer</p>
                        <p className="font-medium text-slate-800">{quote.customer?.display_name || "N/A"}</p>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Mail size={14} /> Email</p>
                        <p className="font-medium text-slate-800">{email}</p>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Phone size={14} /> Phone</p>
                        <p className="font-medium text-slate-800">{phone}</p>
                    </div>
                </div>
            </div>

            {/* Quote Items */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-900">Included Items</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-start">
                        <thead>
                            <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 font-bold bg-slate-50">
                                <th className="px-6 py-4">Item</th>
                                <th className="px-6 py-4">Qty</th>
                                <th className="px-6 py-4 text-end">Unit Price</th>
                                <th className="px-6 py-4 text-end">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {quote.items?.map((item: any, idx: number) => (
                                <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 flex items-center gap-2">
                                            {item.product?.name || "Configured Item"}
                                            {item.is_recurring && (
                                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                                                    {item.billing_frequency}
                                                </span>
                                            )}
                                        </div>
                                        {item.product?.sku && <div className="text-xs text-slate-500 font-mono mt-0.5">SKU: {item.product.sku}</div>}
                                        {item.product?.description && <div className="text-sm text-slate-500 mt-1 line-clamp-2">{item.product.description}</div>}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-700">{item.quantity}</td>
                                    <td className="px-6 py-4 text-end font-medium text-slate-700">{formatCurrency(item.unit_price)}</td>
                                    <td className="px-6 py-4 text-end font-bold text-slate-900">{formatCurrency(item.total_price)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Totals & Signature */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

                {/* Notes / Terms */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-full">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Terms & Notes</h2>
                    <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">
                        {quote.notes || "Standard terms and conditions apply. This quote is valid for 30 days from the date of issue unless otherwise specified."}
                    </p>
                </div>

                {/* Totals */}
                <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-lg border border-slate-800 flex flex-col gap-6">
                    <div className="space-y-3">
                        <div className="flex justify-between text-slate-400">
                            <span>Subtotal</span>
                            <span className="font-medium text-white">{formatCurrency((quote.total_amount || 0) + (quote.discount_total || 0))}</span>
                        </div>
                        {(quote.discount_total > 0) && (
                            <div className="flex justify-between text-emerald-400">
                                <span>Discount</span>
                                <span className="font-medium">-{formatCurrency(quote.discount_total)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-slate-400">
                            <span>Tax Options (VAT)</span>
                            <span className="font-medium text-white">{formatCurrency(quote.tax_total || 0)}</span>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-700/50 flex justify-between items-end">
                        <span className="text-lg text-slate-300 font-medium">Amount Due Today</span>
                        <span className="text-4xl font-black tracking-tight">{formatCurrency(quote.total_amount)}</span>
                    </div>

                    {/* Recurring Subscriptions Block */}
                    {(quote.recurring_total_monthly > 0 || quote.recurring_total_yearly > 0) && (
                        <div className="pt-6 border-t border-slate-700/50 space-y-3">
                            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Subscription Costs</h4>
                            {quote.recurring_total_monthly > 0 && (
                                <div className="flex justify-between items-end">
                                    <span className="text-md text-indigo-200 font-medium">Monthly Recurring</span>
                                    <span className="text-2xl font-black text-indigo-100 tracking-tight">{formatCurrency(quote.recurring_total_monthly)}</span>
                                </div>
                            )}
                            {quote.recurring_total_yearly > 0 && (
                                <div className="flex justify-between items-end mt-2">
                                    <span className="text-md text-indigo-200 font-medium">Yearly Recurring</span>
                                    <span className="text-2xl font-black text-indigo-100 tracking-tight">{formatCurrency(quote.recurring_total_yearly)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Area */}
                    <div className="pt-6 mt-auto">
                        {isAccepted ? (
                            <div className="w-full py-4 px-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center gap-3 font-bold">
                                <CheckCircle2 size={24} />
                                <div>
                                    <div className="text-lg">Quote Accepted</div>
                                    {quote.accepted_at && (
                                        <div className="text-xs font-medium opacity-80 mt-0.5">On {new Date(quote.accepted_at).toLocaleString('en-GB')}</div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <button
                                    onClick={handleAccept}
                                    disabled={submitting}
                                    className="w-full py-4 px-6 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-2xl font-bold text-lg shadow-lg shadow-brand-primary/25 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <CalendarCheck className="w-6 h-6" />
                                            <span>Approve & Sign Quote</span>
                                        </>
                                    )}
                                </button>
                                {error && <p className="text-red-400 text-sm text-center font-medium">{error}</p>}
                                <p className="text-xs text-slate-500 text-center uppercase tracking-wider font-bold">
                                    By clicking approve, you agree to the terms listed.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
