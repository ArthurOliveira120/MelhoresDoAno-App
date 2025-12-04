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

export interface Vote {
  category_id: number;
  option_id: number;
}

export interface Winner {
  category_id: number;
  category_title: string;
  option_id: number;
  option_name: string;
  vote_count: number;
}
