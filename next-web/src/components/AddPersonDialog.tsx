"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { createPerson } from "@/app/actions/createPerson";

interface Props {
    tenantId: string;
    trigger?: React.ReactNode;
}

export default function AddPersonDialog({ tenantId, trigger }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const res = await createPerson({
                ...formData,
                tenantId
            });

            if (res.success) {
                setIsOpen(false);
                setFormData({ firstName: "", lastName: "", email: "", phone: "" });
                // Optional: Show toast success
            } else {
                setError(res.error || "Failed to create person");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <div onClick={() => setIsOpen(true)}>
                {trigger || (
                    <button className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg transition-all font-medium shadow-lg shadow-brand-primary/20">
                        <Plus className="w-4 h-4" />
                        <span>Add Person</span>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-foreground">New Contact</h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors text-2xl leading-none"
                    >
                        &times;
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">First Name</label>
                            <input
                                required
                                type="text"
                                className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                                placeholder="e.g. Omer"
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Last Name</label>
                            <input
                                required
                                type="text"
                                className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                                placeholder="e.g. Malka"
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Email (Optional)</label>
                        <input
                            type="email"
                            className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                            placeholder="user@example.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Phone (Optional)</label>
                        <input
                            type="tel"
                            className="w-full bg-secondary/50 border border-input rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary outline-none transition-colors"
                            placeholder="+972-50-0000000"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                            {error}
                        </div>
                    )}

                    <div className="pt-4 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all text-sm font-bold shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Create Person
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
