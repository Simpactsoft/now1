"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Plus, Percent, Users, Calendar, Settings2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { createCommissionPlan, toggleCommissionPlan } from "@/app/actions/commission-actions";

export default function CommissionAdminClient({ initialPlans, tenantId, teams }: { initialPlans: any[], tenantId: string, teams: any[] }) {
    const [plans, setPlans] = useState(initialPlans);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form fields
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [baseRateStr, setBaseRateStr] = useState("5.0"); // Percentage string (e.g. 5.5 = 5.5%)
    const [effectiveFrom, setEffectiveFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [effectiveTo, setEffectiveTo] = useState("");
    const [targetTeamId, setTargetTeamId] = useState("all");

    const formatRate = (decimal: number) => {
        return (decimal * 100).toFixed(2) + "%";
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            toast.error("Name is required");
            return;
        }

        const rate = parseFloat(baseRateStr);
        if (isNaN(rate) || rate < 0 || rate > 100) {
            toast.error("Valid Base Rate percentage (0-100) is required");
            return;
        }

        setIsSubmitting(true);
        const res = await createCommissionPlan({
            tenantId,
            name: name.trim(),
            description: description.trim(),
            baseRate: rate,
            effectiveFrom,
            effectiveTo: effectiveTo || null,
            targetTeamId: targetTeamId === "all" ? null : targetTeamId
        });

        if (res.success && res.data) {
            toast.success("Commission Plan created");
            // Optimistic update - requires full refetch ideally but for now we inject
            setPlans([{ ...res.data, target_team: teams.find(t => t.id === targetTeamId) }, ...plans]);
            setIsCreateOpen(false);

            // Reset
            setName("");
            setDescription("");
            setBaseRateStr("5.0");
            setEffectiveTo("");
            setTargetTeamId("all");
        } else {
            toast.error(res.error || "Failed to create plan");
        }
        setIsSubmitting(false);
    };

    const handleToggleState = async (planId: string, currentState: boolean) => {
        const newState = !currentState;

        // Optimistic UI
        setPlans(prev => prev.map(p => p.id === planId ? { ...p, is_active: newState } : p));

        const res = await toggleCommissionPlan(tenantId, planId, newState);
        if (res.success) {
            toast.success(`Plan ${newState ? 'activated' : 'deactivated'}`);
        } else {
            toast.error("Failed to update status");
            // Revert
            setPlans(prev => prev.map(p => p.id === planId ? { ...p, is_active: currentState } : p));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button className="bg-brand-primary text-black hover:bg-brand-primary/90" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Plan
                </Button>
            </div>

            {plans.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 border border-dashed border-white/10 rounded-2xl bg-white/5 text-center">
                    <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mb-4 border border-brand-primary/20">
                        <Percent className="w-8 h-8 text-brand-primary" />
                    </div>
                    <h3 className="text-xl font-medium text-zinc-300 mb-2">No Commission Plans</h3>
                    <p className="text-zinc-500 max-w-sm">Create a plan to start rewarding your sales team automatically when deals are marked "Closed Won".</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {plans.map(plan => (
                        <div key={plan.id} className={`flex flex-col p-6 rounded-2xl border transition-all ${plan.is_active ? 'bg-white/5 border-white/10 hover:border-brand-primary/30' : 'bg-black/40 border-white/5 opacity-70'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        {plan.name}
                                        {!plan.is_active && <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 border-zinc-700">Inactive</Badge>}
                                    </h3>
                                    <p className="text-sm text-brand-primary font-medium mt-1 uppercase tracking-wider">
                                        {formatRate(plan.base_rate)} BASE RATE
                                    </p>
                                </div>
                                <Switch
                                    checked={plan.is_active}
                                    onCheckedChange={() => handleToggleState(plan.id, plan.is_active)}
                                />
                            </div>

                            {plan.description && (
                                <p className="text-sm text-zinc-400 mb-6 line-clamp-2 min-h-[40px]">{plan.description}</p>
                            )}

                            <div className="mt-auto grid grid-cols-2 gap-4 p-4 rounded-xl bg-black/40 border border-white/5">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                        <Users className="w-3 h-3" /> Target Team
                                    </span>
                                    <p className="text-sm font-medium text-zinc-200 truncate">
                                        {plan.target_team?.name || "All Organization"}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> Effective
                                    </span>
                                    <p className="text-sm font-medium text-zinc-200 truncate">
                                        {format(new Date(plan.effective_from), 'MMM d, yyyy')}
                                        {plan.effective_to ? ` - ${format(new Date(plan.effective_to), 'MMM d')}` : ' - Present'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Create Commission Plan</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Define the payout structure for won opportunities.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-5 py-4">
                        <div className="grid gap-2">
                            <Label className="text-zinc-300">Plan Name <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="e.g., Enterprise Sales FY26"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="bg-black border-white/10"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label className="text-zinc-300">Base Commission Rate (%) <span className="text-red-500">*</span></Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    placeholder="5.0"
                                    value={baseRateStr}
                                    onChange={e => setBaseRateStr(e.target.value)}
                                    className="bg-black border-white/10 pl-8"
                                />
                                <Percent className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                            </div>
                            <p className="text-xs text-zinc-500 mt-1">Example: For a $10k deal, 5% yields $500.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-zinc-300">Effective Date <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={effectiveFrom}
                                    onChange={e => setEffectiveFrom(e.target.value)}
                                    className="bg-black border-white/10"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-zinc-300">End Date (Optional)</Label>
                                <Input
                                    type="date"
                                    value={effectiveTo}
                                    onChange={e => setEffectiveTo(e.target.value)}
                                    className="bg-black border-white/10"
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label className="text-zinc-300">Target Assigned Team</Label>
                            <Select value={targetTeamId} onValueChange={setTargetTeamId}>
                                <SelectTrigger className="bg-black border-white/10">
                                    <SelectValue placeholder="Select team..." />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                                    <SelectItem value="all">Every User (Global Plan)</SelectItem>
                                    {teams.map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-zinc-500">Only reps in this team hierarchy will trigger this plan.</p>
                        </div>

                        <div className="grid gap-2">
                            <Label className="text-zinc-300">Description</Label>
                            <Textarea
                                placeholder="Details about this plan's parameters..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="bg-black border-white/10 min-h-[80px]"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-white/10 bg-white/5 hover:bg-white/10 text-white">Cancel</Button>
                        <Button onClick={handleCreate} disabled={isSubmitting || !name.trim()} className="bg-brand-primary text-black hover:bg-brand-primary/90">
                            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                            Create Plan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
