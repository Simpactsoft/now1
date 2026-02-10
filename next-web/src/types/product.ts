
export interface Product {
    id: string;
    sku: string;
    name: string;
    description?: string;
    category_id?: string;
    category_name?: string; // from join
    list_price: number;
    cost_price: number;
    track_inventory: boolean;
    stock_quantity: number; // from view
    min_stock?: number;
    status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
    image_url?: string;
    unit?: string;
    barcode?: string;
    tags?: string[];
    created_at?: string;
    updated_at?: string;
}
