import Link from 'next/link';
import { History, Tag } from 'lucide-react';

interface RecentSearchesProps {
    history: string[];
    className?: string;
}

export default function RecentSearchesCard({ history, className }: RecentSearchesProps) {
    // If no history, we can either hide it or show a placeholder.
    // For a dashboard, hiding might layout shift, but empty state is better.
    const hasHistory = history && history.length > 0;

    return (
        <div className={`glass p-8 rounded-3xl border border-white/5 flex flex-col ${className || ''}`}>
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <History className="text-pink-400" size={20} />
                Recent Searches
            </h3>

            {!hasHistory ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm italic min-h-[100px]">
                    <Tag className="w-8 h-8 mb-2 opacity-20" />
                    No recent searches found
                </div>
            ) : (
                <div className="flex flex-wrap gap-2 content-start">
                    {history.map((term, i) => (
                        <Link
                            key={i}
                            href={`/dashboard/people?q=${encodeURIComponent(term)}`}
                            className="
                                group flex items-center gap-1.5 px-3 py-1.5 
                                bg-white/5 hover:bg-white/10 
                                border border-white/10 hover:border-pink-500/30
                                rounded-full text-sm text-slate-300 hover:text-white 
                                transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5
                            "
                        >
                            <span className="opacity-50 group-hover:opacity-100 transition-opacity">#</span>
                            {term}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
