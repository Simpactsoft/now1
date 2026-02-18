"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RefreshCw, Plus, Pencil, Trash2 } from "lucide-react";
import {
    getAuditLog,
    type AuditLogEntry,
} from "@/app/actions/cpq/audit-actions";

interface AuditLogTabProps {
    templateId: string;
}

const ACTION_CONFIG: Record<string, { icon: typeof Plus; color: string; label: string }> = {
    INSERT: { icon: Plus, color: "bg-green-500/10 text-green-600 border-green-500/20", label: "נוצר" },
    UPDATE: { icon: Pencil, color: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "עודכן" },
    DELETE: { icon: Trash2, color: "bg-red-500/10 text-red-600 border-red-500/20", label: "נמחק" },
};

const ENTITY_LABELS: Record<string, string> = {
    product_template: "תבנית",
    option_group: "קבוצת אופציות",
    option: "אופציה",
    configuration_rule: "כלל",
    template_preset: "Preset",
};

export function AuditLogTab({ templateId }: AuditLogTabProps) {
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, startLoading] = useTransition();

    const fetchLog = () => {
        startLoading(async () => {
            const result = await getAuditLog(templateId, { pageSize: 100 });
            if (result.success && result.data) {
                setEntries(result.data);
                setTotal(result.total || 0);
            }
        });
    };

    useEffect(() => {
        fetchLog();
    }, [templateId]);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString("he-IL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    היסטוריית שינויים
                    <Badge variant="secondary" className="ml-2">{total}</Badge>
                </CardTitle>
                <Button variant="outline" size="sm" onClick={fetchLog} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
                    רענן
                </Button>
            </CardHeader>
            <CardContent>
                {entries.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-medium">אין היסטוריה עדיין</p>
                        <p className="text-sm mt-1">
                            שינויים בתבנית, בקבוצות, באופציות ובכללים יירשמו כאן אוטומטית
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="h-[500px]">
                        <div className="space-y-1">
                            {entries.map((entry) => {
                                const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.UPDATE;
                                const Icon = config.icon;
                                const entityLabel = ENTITY_LABELS[entry.entityType] || entry.entityType;

                                return (
                                    <div
                                        key={entry.id}
                                        className="flex items-start gap-3 py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                                    >
                                        <div className={`mt-0.5 p-1.5 rounded-md border ${config.color}`}>
                                            <Icon className="h-3.5 w-3.5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-sm">
                                                    {config.label}
                                                </span>
                                                <Badge variant="outline" className="text-xs">
                                                    {entityLabel}
                                                </Badge>
                                                {entry.entityName && (
                                                    <span className="text-sm text-foreground font-medium truncate">
                                                        &quot;{entry.entityName}&quot;
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {formatDate(entry.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
