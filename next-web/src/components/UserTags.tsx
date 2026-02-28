"use client";

import { useLanguage } from "@/context/LanguageContext";
import { UserCircle, MoreHorizontal, Key, Check, X, Trash2 } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

interface UserTagsProps {
    users: any[];
    loading: boolean;
    onSetPassword: (user: any) => void;
    onToggleStatus: (id: string, currentStatus: string, name: string) => void;
    onDelete: (id: string, name: string) => void;
}

export default function UserTags({
    users,
    loading,
    onSetPassword,
    onToggleStatus,
    onDelete
}: UserTagsProps) {
    const { t, language } = useLanguage();

    if (loading) return null;

    return (
        <div className="flex flex-col gap-4 p-3" dir={language === 'he' ? 'rtl' : 'ltr'}>
            <div className="flex flex-wrap gap-3">
                {users.map((user) => (
                    <UserTagPill
                        key={user.id}
                        user={user}
                        t={t}
                        onSetPassword={onSetPassword}
                        onToggleStatus={onToggleStatus}
                        onDelete={onDelete}
                    />
                ))}
            </div>
        </div>
    );
}

function UserTagPill({ user, t, onSetPassword, onToggleStatus, onDelete }: any) {
    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
            case 'suspended': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
            default: return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
        }
    };

    const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

    return (
        <div className="relative">
            <div
                className={`
                    group flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-200
                    hover:shadow-md hover:scale-105
                    ${getStatusColor(user.status)}
                `}
            >
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                    {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                </div>

                <span className="text-sm font-semibold truncate max-w-[150px]">
                    {displayName}
                </span>

                <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                        <button className="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal size={14} />
                        </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                        <DropdownMenu.Content align="start" className="w-48 bg-popover border border-border rounded-lg shadow-lg py-1 z-50 animate-in fade-in zoom-in-95">
                            <DropdownMenu.Item
                                onSelect={() => onSetPassword({ id: user.id, name: displayName })}
                                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent outline-none cursor-default"
                            >
                                <Key size={14} />
                                {t('setPassword')}
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                                onSelect={() => onToggleStatus(user.id, user.status, displayName)}
                                className={`flex items-center gap-2 px-3 py-2 text-sm outline-none cursor-default ${user.status === 'suspended' ? 'text-green-600 hover:bg-green-50' : 'text-yellow-600 hover:bg-yellow-50'}`}
                            >
                                {user.status === 'suspended' ? <Check size={14} /> : <X size={14} />}
                                {user.status === 'suspended' ? t('activateUser') : t('suspendUser')}
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="h-px bg-border my-1" />
                            <DropdownMenu.Item
                                onSelect={() => onDelete(user.id, displayName)}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 outline-none cursor-default font-medium"
                            >
                                <Trash2 size={14} />
                                {t('deleteUser')}
                            </DropdownMenu.Item>
                        </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                </DropdownMenu.Root>
            </div>
        </div>
    );
}
