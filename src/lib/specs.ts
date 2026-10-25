export const BODY_TYPES = [
  "Sedan",
  "SUV",
  "Truck",
  "Coupe",
  "Hatchback",
  "Wagon",
  "Van",
  "Convertible",
] as const;

export const FUEL_TYPES = ["Gasoline", "Diesel", "Hybrid", "Electric"] as const;
export const TRANSMISSIONS = ["Automatic", "Manual", "CVT", "DCT"] as const;
export const DRIVETRAINS = ["FWD", "RWD", "AWD", "4WD"] as const;
export const TITLE_STATUSES = ["Clean", "Rebuilt", "Salvage"] as const;

export const COLORS = [
  "Black",
  "White",
  "Gray",
  "Silver",
  "Blue",
  "Red",
  "Green",
  "Brown",
  "Beige",
  "Orange",
  "Yellow",
  "Other",
] as const;

export const CURRENT_YEAR = new Date().getFullYear();
export const MIN_YEAR = 1981; // first year with the standardized 17-character VIN
