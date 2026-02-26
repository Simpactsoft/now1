
import { ColumnDef } from "@/components/entity-view/types";
import { formatDistanceToNow } from "date-fns";
import { User, Phone, Mail, Briefcase, Calendar } from "lucide-react";
import Link from "next/link";

export const peopleColumns: ColumnDef<any>[] = [
    {
        field: "first_name", // We'll combine first/last in renderer or use computed field
        headerName: "Name",
        minWidth: 200,
        flex: 2,
        cellRenderer: ({ data }) => {
            const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Unknown';
            const id = data.id || data.ret_id;
            return (
                <Link href={`/dashboard/people/${id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-3 py-1 group w-full cursor-pointer hover:bg-slate-50/50 rounded-md transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {data.first_name?.[0]}{data.last_name?.[0]}
                    </div>
                    <div className="min-w-0">
                        <div className="font-medium text-foreground group-hover:underline group-hover:text-blue-600 truncate">{fullName}</div>
                        {data.role && <div className="text-xs text-muted-foreground truncate">{data.role}</div>}
                    </div>
                </Link>
            );
        }
    },
    {
        field: "email",
        headerName: "Email",
        width: 200,
        cellRenderer: ({ value }) => (
            <div className="flex items-center gap-2 text-muted-foreground" >
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate" > {value} </span>
            </div>
        )
    },
    {
        field: "phone",
        headerName: "Phone",
        width: 150,
        cellRenderer: ({ value }) => (
            <div className="flex items-center gap-2 text-muted-foreground" >
                <Phone className="w-3.5 h-3.5" />
                <span>{value || '-'
                } </span>
            </div>
        )
    },
    {
        field: "status",
        headerName: "Status",
        width: 120,
        cellRenderer: ({ value }) => {
            if (!value) return null;
            const status = String(value).toUpperCase();
            let colorClass = "bg-secondary text-secondary-foreground border-border";

            if (status === 'ACTIVE') colorClass = "bg-green-500/10 text-green-600 border-green-500/20";
            else if (status === 'LEAD') colorClass = "bg-blue-500/10 text-blue-600 border-blue-500/20";
            else if (status === 'INACTIVE') colorClass = "bg-red-500/10 text-red-600 border-red-500/20";

            return (
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${colorClass}`
                }>
                    {value}
                </span>
            );
        }
    },
    {
        field: "created_at",
        headerName: "Added",
        width: 140,
        valueFormatter: (value) => {
            if (!value) return '-';
            try { return formatDistanceToNow(new Date(value), { addSuffix: true }); }
            catch { return '-'; }
        }
    }
];
