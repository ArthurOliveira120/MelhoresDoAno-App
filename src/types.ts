export interface Category {
    id: number;
    title: string;
    order: number;
}

export interface Option {
    id: number;
    category_id: number;
    name: string;
}