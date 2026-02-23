"use client";

import { useState } from "react";
import { format } from "date-fns";
import { DollarSign, Wallet, ArrowUpRight, ArrowDownRight, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export default function CommissionsDashboardClient({ initialLedger, tenantId, user, currentView }: { initialLedger: any[], tenantId: string, user: any, currentView: string }) {
    const [ledger, setLedger] = useState(initialLedger || []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const formatRate = (decimal: number) => {
        return (decimal * 100).toFixed(2) + "%";
    };

    const totalCommissions = ledger.reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
    const pendingCommissions = ledger.filter(i => i.status === 'pending').reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);
    const paidCommissions = ledger.filter(i => i.status === 'paid').reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-500/10"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
            case 'approved': return <Badge variant="outline" className="border-blue-500/50 text-blue-600 dark:text-blue-500 bg-blue-100 dark:bg-blue-500/10">Approved</Badge>;
            case 'paid': return <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 dark:text-emerald-500 bg-emerald-100 dark:bg-emerald-500/10"><CheckCircle2 className="w-3 h-3 mr-1" /> Paid</Badge>;
            case 'clawback': return <Badge variant="outline" className="border-red-500/50 text-red-600 dark:text-red-500 bg-red-100 dark:bg-red-500/10">Clawback</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-card shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings (YTD)</CardTitle>
                        <Wallet className="w-4 h-4 text-muted-foreground/80" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{formatCurrency(totalCommissions)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            +{formatCurrency(totalCommissions * 0.1)} from last period
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-card shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-amber-600 dark:text-amber-500/80">Pending Payout</CardTitle>
                        <Clock className="w-4 h-4 text-amber-600/70 dark:text-amber-500/50" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{formatCurrency(pendingCommissions)}</div>
                        <p className="text-xs text-amber-600/80 dark:text-amber-500/60 mt-1">
                            Awaiting manager approval
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-emerald-50 dark:bg-emerald-950/20 shadow-sm border-emerald-200 dark:border-emerald-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-500/80">Received to Date</CardTitle>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500/50" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">{formatCurrency(paidCommissions)}</div>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-500/60 mt-1">
                            Transfer complete
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg text-foreground">Commission Ledger</CardTitle>
                    <CardDescription>Record of closed won opportunities and manual adjustments.</CardDescription>
                </CardHeader>
                <CardContent>
                    {ledger.length === 0 ? (
                        <div className="text-center py-12">
                            <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                            <h3 className="text-foreground font-medium mb-1">No commissions yet</h3>
                            <p className="text-muted-foreground text-sm">Close won a deal to see it appear here automatically.</p>
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="font-medium">Date</TableHead>
                                        <TableHead className="font-medium">Source</TableHead>
                                        <TableHead className="font-medium">Plan Applied</TableHead>
                                        <TableHead className="font-medium text-right">Deal Value</TableHead>
                                        <TableHead className="font-medium text-right">Commission</TableHead>
                                        <TableHead className="font-medium">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {ledger.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="py-3 text-muted-foreground">
                                                {format(new Date(row.created_at), 'MMM d, yyyy')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-foreground">
                                                    {row.opportunity?.name || 'Unknown Opportunity'}
                                                </div>
                                                <div className="text-xs text-muted-foreground capitalize">{row.entity_type}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-foreground">{row.plan?.name || 'Manual Adjustment'}</span>
                                                    {row.plan && (
                                                        <Badge variant="secondary" className="text-[10px] h-5">
                                                            {formatRate(row.commission_rate)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground font-mono">
                                                {formatCurrency(row.deal_value)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className={cn(
                                                    "font-medium",
                                                    row.status === 'clawback' ? "text-red-500" : "text-emerald-600 dark:text-emerald-500"
                                                )}>
                                                    {row.status === 'clawback' ? '-' : '+'}{formatCurrency(row.commission_amount)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(row.status)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
