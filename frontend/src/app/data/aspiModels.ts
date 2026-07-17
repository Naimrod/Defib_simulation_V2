export type Aspi = "AspiSelect";

export interface AspiModel {
    brand: string;
    values: number[];
    initialValue: number;
    leakStart: number;
    leakMax: number;
    ring: [string, string, string];
    pointer: [string, string];
    on: boolean;
    name: string;
}

export const ASPI_MODELS :  Record<Aspi, AspiModel> = {
    AspiSelect : {
    brand: "Debflo",
    values: [0,-200,-400,-600,-800,-1000],
    initialValue: 0,
    leakStart: 0,
    leakMax: -1000,
    ring: ["#cdd37d", "#f7f4c8", "#a0a834"],
    pointer: ["#fafbd9", "#afb835"],
    on: false,
    name:"Aspi"
  },
}