export type Aspi = "Aspi";

export interface AspiModel {
    brand: string;
    values: number[];
    initialValue: number;
    leakStart: number;
    leakMax: number;
    ring: [string, string, string];
    pointer: [string, string];
    on: boolean;
}

export const ASPI_MODELS :  Record<Aspi, AspiModel> = {
    Aspi : {
    brand: "Debflo",
    values: [0,100,200,300],
    initialValue: 0,
    leakStart: 100,
    leakMax: 300,
    ring: ["#cdd37d", "#f7f4c8", "#a0a834"],
    pointer: ["#fafbd9", "#afb835"],
    on: false
  },
}