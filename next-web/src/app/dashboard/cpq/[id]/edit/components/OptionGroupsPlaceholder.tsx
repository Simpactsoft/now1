"use client";

import type { OptionGroup } from "@/app/actions/cpq/template-actions";
import { OptionGroupsManager } from "./OptionGroupsManager";

interface OptionGroupsPlaceholderProps {
    templateId: string;
    optionGroups: OptionGroup[];
}

export function OptionGroupsPlaceholder({
    templateId,
    optionGroups = [],
}: OptionGroupsPlaceholderProps) {
    return (
        <div className="space-y-6">
            <OptionGroupsManager templateId={templateId} groups={optionGroups} />
        </div>
    );
}
