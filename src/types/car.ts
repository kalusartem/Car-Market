export interface CarListing {
  id: string;
  seller_id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuel_type: string;
  transmission: string;
  description: string;
  image_ids: string[]; // This matches our new ID-only architecture
  is_active: boolean;
  created_at: string;
}
