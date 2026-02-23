"use client";

import { useState } from "react";
import { updatePortalProfile } from "@/app/actions/portal-profile-actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Save, User, Building, Phone, AlertTriangle, Mail } from "lucide-react";

export function PortalProfileForm({ initialData }: { initialData: any }) {
    const [loading, setLoading] = useState(false);
    const getPhone = (methods: any) => {
        if (!methods) return "";
        if (Array.isArray(methods)) return methods.find((m: any) => m.type === 'phone')?.value || "";
        if (typeof methods === 'object') return methods.phone || "";
        return "";
    };

    const [formData, setFormData] = useState({
        first_name: initialData.first_name || "",
        last_name: initialData.last_name || "",
        email: initialData.email || "",
        phone: initialData.phone || getPhone(initialData.contact_methods),
        job_title: initialData.job_title || initialData.metadata?.job_title || initialData.custom_fields?.job_title || "",
        department: initialData.department || initialData.metadata?.department || initialData.custom_fields?.department || ""
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const loadingToast = toast.loading("Updating profile...");

        const res = await updatePortalProfile(formData);

        if (res.success) {
            toast.success("Profile updated perfectly", { id: loadingToast });
        } else {
            toast.error(res.error || "Failed to update profile", { id: loadingToast });
        }
        setLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {initialData.source === 'auth_fallback' && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 flex gap-3 text-sm">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                    <div>
                        <p className="font-semibold mb-1">Test Account Detected</p>
                        <p>Your email ({initialData.email}) is not registered as a customer in the CRM system. You are viewing a generic test profile and cannot save changes.</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <User size={16} />
                        </div>
                        <input
                            type="text"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleChange}
                            required
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-slate-900"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <User size={16} />
                        </div>
                        <input
                            type="text"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleChange}
                            required
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-slate-900"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Mail size={16} />
                        </div>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-slate-900"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Phone size={16} />
                        </div>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-slate-900"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Building size={16} />
                        </div>
                        <input
                            type="text"
                            name="job_title"
                            value={formData.job_title}
                            onChange={handleChange}
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-slate-900"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Status</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <div className={`w-2 h-2 rounded-full ${initialData.status?.toLowerCase() === 'customer' ? 'bg-green-500' :
                                initialData.status?.toLowerCase() === 'lead' ? 'bg-blue-500' :
                                    'bg-slate-400'
                                }`} />
                        </div>
                        <input
                            type="text"
                            value={initialData.status || "Lead"}
                            disabled
                            className="block w-full pl-10 pr-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-500 sm:text-sm cursor-not-allowed"
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button
                    type="submit"
                    disabled={loading || initialData.source === 'auth_fallback'}
                    className="flex items-center gap-2"
                >
                    <Save size={16} />
                    {loading ? "Saving..." : "Save Changes"}
                </Button>
            </div>
        </form>
    );
}
