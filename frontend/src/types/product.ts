export type ProductStatus = 'not_started' | 'active' | 'ended';

export interface Product {
  id: string;
  title: string;
  description: string;
  basePrice: number;
  k: number;
  startTime: number;
  endTime: number;
  status: ProductStatus;
  currentHighestPrice: number;
  alpha?: number;
  beta?: number;
  gamma?: number;
}

export interface ProductResult {
  rank: number;
  userId: string;
  displayName: string;
  finalPrice: number;
  finalScore: number;
  isWinner: boolean;
}

