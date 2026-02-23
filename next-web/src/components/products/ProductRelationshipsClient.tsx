"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, X, Link as LinkIcon, AlertCircle, TrendingUp, Search, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    fetchProductRelationships,
    upsertProductRelationship,
    removeProductRelationship,
    searchProducts
} from "@/app/actions/product-relationship-actions";

interface ProductRelationshipsClientProps {
    tenantId: string;
    productId: string;
    productName: string;
}

export default function ProductRelationshipsClient({ tenantId, productId, productName }: ProductRelationshipsClientProps) {
    const [relationships, setRelationships] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    // Form state
    const [selectedTargetId, setSelectedTargetId] = useState("");
    const [selectedType, setSelectedType] = useState<'upsell' | 'cross_sell' | 'accessory'>('upsell');
    const [confidence, setConfidence] = useState("100");

    useEffect(() => {
        loadRelationships();
    }, [tenantId, productId]);

    const loadRelationships = async () => {
        setLoading(true);
        const res = await fetchProductRelationships(tenantId, productId);
        if (res.success && res.data) {
            setRelationships(res.data);
        } else {
            toast.error(res.error || "Failed to load product relationships");
        }
        setLoading(false);
    };

    const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        const res = await searchProducts(tenantId, query);
        if (Array.isArray(res)) {
            // Filter out the current product from search results
            setSearchResults(res.filter(p => p.id !== productId).slice(0, 5));
        }
        setSearching(false);
    };

    const handleAddRelationship = async () => {
        if (!selectedTargetId) {
            toast.error("Please select a target product");
            return;
        }

        const score = parseFloat(confidence);
        if (isNaN(score) || score < 0 || score > 100) {
            toast.error("Confidence score must be between 0 and 100");
            return;
        }

        const res = await upsertProductRelationship({
            tenantId,
            sourceProductId: productId,
            targetProductId: selectedTargetId,
            relationshipType: selectedType,
            confidenceScore: score
        });

        if (res.success) {
            toast.success("Relationship added");
            setSearchQuery("");
            setSelectedTargetId("");
            setSearchResults([]);
            loadRelationships();
        } else {
            toast.error(res.error || "Failed to add relationship");
        }
    };

    const handleRemove = async (id: string) => {
        if (!confirm("Are you sure you want to remove this connection?")) return;

        const res = await removeProductRelationship(tenantId, id);
        if (res.success) {
            toast.success("Relationship removed");
            setRelationships(prev => prev.filter(r => r.id !== id));
        } else {
            toast.error(res.error || "Failed to remove relationship");
        }
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'upsell': return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Upsell</Badge>;
            case 'cross_sell': return <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Cross-sell</Badge>;
            case 'accessory': return <Badge variant="outline" className="border-zinc-300 dark:border-zinc-700">Accessory</Badge>;
            default: return <Badge>{type}</Badge>;
        }
    };

    const selectedProductDetails = searchResults.find(p => p.id === selectedTargetId) ||
        relationships.find(r => r.target_product_id === selectedTargetId)?.target_product;

    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <LinkIcon className="w-5 h-5 text-muted-foreground" />
                        Related Products & Recommendations
                    </CardTitle>
                    <CardDescription>
                        Link accessories, up-sells, and cross-sells to {productName}. These appear as AI suggestions in the CPQ Quote Builder.
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x dark:divide-white/10">

                    {/* Add Relationship Form */}
                    <div className="p-6 space-y-4">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                            <Plus className="w-4 h-4 text-primary" /> Add Connection
                        </h4>

                        <div className="space-y-3">
                            <div className="space-y-1 relative">
                                <Label>Search Products</Label>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Type SKU or name..."
                                        value={searchQuery}
                                        onChange={handleSearch}
                                        className="pl-9"
                                    />
                                </div>
                                {searching && <div className="text-xs text-muted-foreground mt-1">Searching...</div>}

                                {/* Search Results Dropdown Simulation */}
                                {searchResults.length > 0 && !selectedTargetId && (
                                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                                        {searchResults.map(p => (
                                            <div
                                                key={p.id}
                                                className="p-2 hover:bg-muted cursor-pointer text-sm flex justify-between items-center"
                                                onClick={() => {
                                                    setSelectedTargetId(p.id);
                                                    setSearchQuery(p.name);
                                                    setSearchResults([]); // Hide results after selection
                                                }}
                                            >
                                                <div>
                                                    <div className="font-medium">{p.name}</div>
                                                    <div className="text-xs text-muted-foreground">{p.sku}</div>
                                                </div>
                                                <Badge variant="secondary" className="text-[10px]">${p.list_price}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {selectedTargetId && (
                                <div className="p-3 bg-muted/50 rounded-md border flex justify-between items-start">
                                    <div>
                                        <p className="text-sm font-medium">{selectedProductDetails?.name || 'Selected Product'}</p>
                                        <p className="text-xs text-muted-foreground">{selectedProductDetails?.sku}</p>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                                        setSelectedTargetId("");
                                        setSearchQuery("");
                                    }}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}

                            <div className="space-y-1">
                                <Label>Relationship Type</Label>
                                <Select value={selectedType} onValueChange={(val: any) => setSelectedType(val)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="upsell">Upsell (Higher value alternative)</SelectItem>
                                        <SelectItem value="cross_sell">Cross-sell (Complementary item)</SelectItem>
                                        <SelectItem value="accessory">Accessory (Add-on part)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <Label>AI Confidence Score</Label>
                                    <span className="text-xs text-muted-foreground">{confidence}%</span>
                                </div>
                                <Input
                                    type="range"
                                    min="0" max="100"
                                    value={confidence}
                                    onChange={(e) => setConfidence(e.target.value)}
                                />
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                    Higher scores rank the suggestion higher in the Quote Builder AI panel.
                                </p>
                            </div>

                            <Button
                                className="w-full"
                                onClick={handleAddRelationship}
                                disabled={!selectedTargetId}
                            >
                                Link Product
                            </Button>
                        </div>
                    </div>

                    {/* Active Relationships List */}
                    <div className="p-0 md:col-span-2 bg-muted/10">
                        {loading ? (
                            <div className="flex justify-center items-center h-full p-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : relationships.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                                <Activity className="w-12 h-12 text-muted-foreground/30 mb-4" />
                                <h3 className="text-lg font-medium">No related products</h3>
                                <p className="text-sm text-muted-foreground max-w-[250px] mt-1">
                                    Link products here to automatically suggest them to sales reps during quoting.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y dark:divide-white/10">
                                {relationships.map((rel) => (
                                    <div key={rel.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1">
                                                {getTypeBadge(rel.relationship_type)}
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-foreground">
                                                    {rel.target_product?.name || 'Unknown Product'}
                                                </h4>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                                    <span>SKU: {rel.target_product?.sku}</span>
                                                    <span className="flex items-center gap-1">
                                                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                                                        {rel.confidence_score}% Match
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="text-sm font-medium">
                                                    ${rel.target_product?.list_price || '0.00'}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">List Price</div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => handleRemove(rel.id)}>
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
