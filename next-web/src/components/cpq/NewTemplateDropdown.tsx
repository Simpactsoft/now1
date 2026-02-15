"use client";

import { useState, useEffect } from "react";
import { Sliders, ChevronDown, Sparkles, DollarSign } from "lucide-react";
import { useRouter } from "next/navigation";
import { Configuration } from "@/app/actions/cpq/configuration-actions";
import { getConfigurationTemplates } from "@/app/actions/cpq/configuration-actions";

interface NewTemplateDropdownProps {
    tenantId: string | null;
}

export default function NewTemplateDropdown({ tenantId }: NewTemplateDropdownProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [configurations, setConfigurations] = useState<Configuration[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && configurations.length === 0) {
            loadConfigurations();
        }
    }, [isOpen]);

    const loadConfigurations = async () => {
        setLoading(true);
        try {
            const result = await getConfigurationTemplates();
            if (result.success && result.data) {
                setConfigurations(result.data);
            }
        } catch (error) {
            console.error("Failed to load configurations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartFromScratch = () => {
        setIsOpen(false);
        router.push('/dashboard/cpq/new');
    };

    const handleLoadConfiguration = (config: Configuration) => {
        setIsOpen(false);
        // Navigate with configuration ID to pre-populate
        router.push(`/dashboard/cpq/new?clone=${config.id}`);
    };

    return (
        <div className="relative">
            {/* Dropdown Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
            >
                <Sliders className="w-4 h-4" />
                + New Template
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[100]"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div className="absolute left-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-border rounded-lg shadow-xl z-[9999] py-2">
                        {/* Start from Scratch */}
                        <button
                            onClick={handleStartFromScratch}
                            className="w-full px-4 py-3 hover:bg-accent flex items-center gap-3 text-left transition-colors"
                        >
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Sparkles className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                                <div className="font-medium text-sm">Start from Scratch</div>
                                <div className="text-xs text-muted-foreground">Create a new blank template</div>
                            </div>
                        </button>

                        {/* Divider */}
                        <div className="my-2 border-t border-border" />

                        {/* Load from Saved */}
                        <div className="px-4 py-2">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                Load from Saved
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-4">
                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : configurations.length === 0 ? (
                                <div className="py-4 text-center">
                                    <p className="text-sm text-muted-foreground">No saved configurations</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Create configurations in Quote Builder
                                    </p>
                                </div>
                            ) : (
                                <div className="max-h-64 overflow-y-auto space-y-1">
                                    {configurations.map(config => (
                                        <button
                                            key={config.id}
                                            onClick={() => handleLoadConfiguration(config)}
                                            className="w-full px-3 py-2 hover:bg-accent rounded-md text-left transition-colors group"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium group-hover:text-primary transition-colors">
                                                    {config.templateName || "Unnamed"}
                                                </span>
                                                <span className="text-sm font-semibold text-primary flex items-center gap-0.5">
                                                    <DollarSign className="w-3 h-3" />
                                                    {config.totalPrice.toLocaleString('en-US', {
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 0
                                                    })}
                                                </span>
                                            </div>
                                            {config.notes && (
                                                <p className="text-xs text-muted-foreground line-clamp-1">
                                                    {config.notes}
                                                </p>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
