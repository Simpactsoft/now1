"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchPeople } from "@/app/actions/fetchPeople";
import { UserCircle, Building2, Briefcase, MapPin, Tag, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface PeopleCardsProps {
    tenantId: string;
}

export default function PeopleCards({ tenantId }: PeopleCardsProps) {
    const [people, setPeople] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const router = useRouter();

    // Use a simple load more observer for now
    const observerTarget = useRef(null);

    // Debounce Search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setPage(0);
            setPeople([]);
            setHasMore(true);
            loadMore(true); // Reset load
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const loadMore = useCallback(async (reset = false) => {
        if (loading && !reset) return;
        if (!hasMore && !reset) return;

        setLoading(true);

        try {
            const currentPage = reset ? 0 : page;
            const startRow = currentPage * 50;
            const endRow = startRow + 50;

            const result = await fetchPeople({
                startRow,
                endRow,
                filterModel: {},
                sortModel: [],
                tenantId,
                query: searchTerm
            });

            if (result.rowData) {
                if (result.rowData.length < 50) {
                    setHasMore(false);
                }
                setPeople(prev => reset ? result.rowData : [...prev, ...result.rowData]);
                setPage(p => reset ? 1 : p + 1);
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error("Failed to load people", e);
        } finally {
            setLoading(false);
        }
    }, [page, loading, hasMore, tenantId, searchTerm]);

    // Initial Load
    useEffect(() => {
        // Initial load handled by searchTerm effect or manual call?
        // SearchTerm effect handles it because it runs on mount (searchTerm starts as "")
    }, []);

    // Infinite Scroll Intersection Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore && !loading) {
                    loadMore();
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [observerTarget, loadMore, hasMore, loading]);


    const getTagColor = (tag: string) => {
        const colors = [
            'bg-red-500/10 text-red-600 border-red-500/20',
            'bg-blue-500/10 text-blue-600 border-blue-500/20',
            'bg-green-500/10 text-green-600 border-green-500/20',
            'bg-purple-500/10 text-purple-600 border-purple-500/20',
            'bg-orange-500/10 text-orange-600 border-orange-500/20'
        ];
        let hash = 0;
        for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div className="w-full flex flex-col gap-4">
            {/* Search Bar */}
            <div className="px-4 w-full max-w-md">
                <div className="flex items-center gap-3 px-3 w-full bg-secondary/50 rounded-xl border border-border focus-within:border-primary/50 focus-within:bg-secondary/70 transition-all">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search by name, role, or company..."
                        className="w-full bg-transparent text-foreground placeholder-muted-foreground px-4 py-2.5 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-4">
                {people.map((person, idx) => {
                    const displayName = person.ret_name || person.name || person.full_name || 'Unknown';
                    const avatarUrl = person.ret_avatar_url || person.avatar_url;
                    const tags = person.ret_tags || [];
                    const role = person.role_name || person.role;
                    const company = person.company_name || person.company;
                    const id = person.ret_id || person.id;

                    return (
                        <div
                            key={`${id}-${idx}`}
                            onClick={() => router.push(`/dashboard/${tenantId}/people/${id}`)}
                            className="group relative flex flex-col bg-card hover:bg-accent/50 border border-border hover:border-primary/50 rounded-2xl p-5 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={displayName} className="w-12 h-12 rounded-full object-cover border border-border" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                                            <UserCircle className="w-7 h-7" />
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <h3 className="font-bold text-lg text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-1" title={displayName}>
                                            {displayName}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                            {role && (
                                                <span className="flex items-center gap-1 max-w-[120px] truncate">
                                                    <Briefcase className="w-3 h-3" />
                                                    {role}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tags Grid - The Highlight */}
                            <div className="flex-1 mb-4">
                                {tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((tag: string, tIdx: number) => (
                                            <span
                                                key={tIdx}
                                                className={`px-2.5 py-1 rounded-md text-xs font-medium border ${getTagColor(tag)}`}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-muted-foreground/50 text-sm italic py-2">
                                        <Tag className="w-4 h-4" />
                                        No tags
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {company && (
                                        <span className="flex items-center gap-1">
                                            <Building2 className="w-3 h-3" />
                                            {company}
                                        </span>
                                    )}
                                </div>
                                <span className={`flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border
                                    ${person.ret_status === 'customer' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                                        person.ret_status === 'churned' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                                            'bg-blue-500/10 text-blue-600 border-blue-500/20'}`
                                }>
                                    {person.ret_status || 'Lead'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Load More Trigger */}
            <div ref={observerTarget} className="w-full py-8 flex items-center justify-center">
                {loading && (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span className="text-sm">Loading more contacts...</span>
                    </div>
                )}
                {!hasMore && people.length > 0 && (
                    <span className="text-xs text-muted-foreground">No more contacts to load</span>
                )}
            </div>
        </div>
    );
}
