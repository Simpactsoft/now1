"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Key, Loader2, CheckCircle2 } from "lucide-react";
import { grantPortalAccess } from "@/app/actions/portal-auth-actions";

interface PortalAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    tenantId: string;
    cardId: string;
    customerEmail?: string;
    customerName?: string;
}

export function PortalAccessModal({ isOpen, onClose, tenantId, cardId, customerEmail, customerName }: PortalAccessModalProps) {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    // If no email is provided to the card initially, they must define one first (or we can prompt them, but strictly it requires an email on file).
    const emailToUse = customerEmail || "";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await grantPortalAccess({
                tenantId,
                cardId,
                email: emailToUse,
                password
            });

            if (res.success) {
                setSuccess(true);
            } else {
                setError(res.error || "Failed to grant portal access.");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />
                <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-2xl z-50 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between p-4 border-b border-slate-100">
                        <Dialog.Title className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Key size={18} className="text-indigo-600" />
                            Grant Portal Access
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors">
                                <X size={18} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="p-6">
                        {success ? (
                            <div className="text-center py-4">
                                <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle2 size={24} />
                                </div>
                                <h3 className="text-lg font-medium text-slate-800 mb-2">Access Granted!</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    The customer can now log into the portal using their email ({emailToUse}) and the password you set.
                                </p>
                                <button
                                    onClick={onClose}
                                    className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 py-2 rounded-lg font-medium transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && (
                                    <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-medium border border-red-100 flex items-start gap-2">
                                        <span className="mt-0.5">⚠️</span>
                                        <span>{error}</span>
                                    </div>
                                )}

                                {!emailToUse ? (
                                    <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm border border-amber-200">
                                        This contact is missing an email address. You must define an email in their profile before granting portal access.
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                                            <span className="block text-xs text-slate-500 font-medium uppercase mb-1">Customer Target</span>
                                            <span className="block text-sm font-semibold text-slate-800">{customerName || 'Unknown Contact'}</span>
                                            <span className="block text-sm text-slate-600">{emailToUse}</span>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5 cursor-pointer">
                                                Assign a Manual Password
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g., ChangeMe123!"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <p className="text-xs text-slate-500 mt-1.5">
                                                The customer will use this exact password to log into the client portal. Minimum 6 characters.
                                            </p>
                                        </div>

                                        <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 mt-6">
                                            <button
                                                type="button"
                                                onClick={onClose}
                                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={loading || password.length < 6}
                                                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {loading && <Loader2 size={16} className="animate-spin" />}
                                                Grant Access
                                            </button>
                                        </div>
                                    </>
                                )}
                            </form>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
