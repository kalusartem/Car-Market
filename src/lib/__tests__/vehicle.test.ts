import { describe, expect, it } from "vitest";
import {
  buildMakeLists,
  isNoiseMake,
  hasValidCheckDigit,
  isValidVinFormat,
  mapBodyClass,
  mapDriveType,
  mapFuel,
  mapTransmission,
  normalizeVin,
  prettyMake,
} from "../vehicle";

describe("prettyMake", () => {
  it("title-cases the all-caps names vPIC returns", () => {
    expect(prettyMake("TOYOTA")).toBe("Toyota");
    expect(prettyMake("MERCEDES-BENZ")).toBe("Mercedes-Benz");
    expect(prettyMake("ALFA ROMEO")).toBe("Alfa Romeo");
    expect(prettyMake("ROLLS-ROYCE")).toBe("Rolls-Royce");
  });
  it("keeps acronyms and mixed-case names", () => {
    expect(prettyMake("BMW")).toBe("BMW");
    expect(prettyMake("GMC")).toBe("GMC");
    expect(prettyMake("MCLAREN")).toBe("McLaren");
    expect(prettyMake("Rivian")).toBe("Rivian");
  });
});

describe("buildMakeLists", () => {
  it("splits popular from the rest and de-duplicates case/space/hyphen variants", () => {
    const { popular, all } = buildMakeLists(["TOYOTA", "Toyota", "MERCEDES BENZ", "ZZ MOTORS", "AARDVARK"]);
    expect(popular).toContain("Toyota");
    expect(popular.filter((m) => /toyota/i.test(m))).toHaveLength(1);
    expect(popular.filter((m) => /mercedes/i.test(m))).toHaveLength(1);
    expect(all).toEqual(["Aardvark", "Zz Motors"]);
  });
  it("always offers the popular makes even if the API omits them", () => {
    expect(buildMakeLists([]).popular).toContain("Honda");
  });
});

describe("VIN helpers", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeVin(" 1m8gdm9a xkp042788 ")).toBe("1M8GDM9AXKP042788".toUpperCase());
  });
  it("validates format (17 chars, no I/O/Q)", () => {
    expect(isValidVinFormat("1M8GDM9AXKP042788")).toBe(true);
    expect(isValidVinFormat("1M8GDM9AXKP04278")).toBe(false);
    expect(isValidVinFormat("1M8GDM9AXKP04278I")).toBe(false);
  });
  it("validates the check digit (the canonical example VIN)", () => {
    expect(hasValidCheckDigit("1M8GDM9AXKP042788")).toBe(true);
    expect(hasValidCheckDigit("1M8GDM9A1KP042788")).toBe(false);
  });
});

describe("vPIC field mapping", () => {
  it("maps body classes", () => {
    expect(mapBodyClass("Sedan/Saloon")).toBe("Sedan");
    expect(mapBodyClass("Sport Utility Vehicle (SUV)/Multi-Purpose Vehicle (MPV)")).toBe("SUV");
    expect(mapBodyClass("Crossover Utility Vehicle (CUV)")).toBe("SUV");
    expect(mapBodyClass("Pickup")).toBe("Truck");
    expect(mapBodyClass("Hatchback/Liftback/Notchback")).toBe("Hatchback");
    expect(mapBodyClass("Convertible/Cabriolet")).toBe("Convertible");
    expect(mapBodyClass("Minivan")).toBe("Van");
    expect(mapBodyClass("")).toBe("");
  });
  it("maps drive types and leaves ambiguous 4x2 empty", () => {
    expect(mapDriveType("AWD/All-Wheel Drive")).toBe("AWD");
    expect(mapDriveType("4WD/4-Wheel Drive/4x4")).toBe("4WD");
    expect(mapDriveType("FWD/Front-Wheel Drive")).toBe("FWD");
    expect(mapDriveType("RWD/Rear-Wheel Drive")).toBe("RWD");
    expect(mapDriveType("4x2")).toBe("");
  });
  it("maps fuel including hybrids and EVs", () => {
    expect(mapFuel("Gasoline", "", "")).toBe("Gasoline");
    expect(mapFuel("Diesel", "", "")).toBe("Diesel");
    expect(mapFuel("Electric", "", "BEV (Battery Electric Vehicle)")).toBe("Electric");
    expect(mapFuel("Gasoline", "Electric", "HEV (Hybrid Electric Vehicle)")).toBe("Hybrid");
    expect(mapFuel("Gasoline", "Electric", "")).toBe("Hybrid");
  });
  it("maps transmissions", () => {
    expect(mapTransmission("Continuously Variable Transmission (CVT)")).toBe("CVT");
    expect(mapTransmission("Dual-clutch transmission (DCT)")).toBe("DCT");
    expect(mapTransmission("Manual/Standard")).toBe("Manual");
    expect(mapTransmission("Automatic")).toBe("Automatic");
  });
});

describe("isNoiseMake", () => {
  it("hides coachbuilders and one-off shops but keeps real brands", () => {
    for (const bad of ["Creative Coachworks Inc.", "1955 Custom Belair", "Hunter Design Group, Llc", "A & O", "Orion Bus", "Th!nk"]) {
      expect(isNoiseMake(bad), bad).toBe(true);
    }
    for (const good of ["Ferrari", "Alfa Romeo", "Aston Martin", "Rolls-Royce", "Lucid", "Polestar", "Saab", "Mercedes-Benz", "Lamborghini"]) {
      expect(isNoiseMake(good), good).toBe(false);
    }
  });
});
