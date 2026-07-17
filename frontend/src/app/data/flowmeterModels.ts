export type FlowmeterMode = "O2" | "Air" | "Aspi";

export interface FlowmeterModel {
  brand: string;
  values: number[];
  initialValue: number;
  leakStart: number;
  leakMax: number;
  ring: [string, string, string];
  pointer: [string, string];
  name: string;
}

export const FLOWMETER_MODELS: Record<FlowmeterMode, FlowmeterModel> = {
  O2: {
    brand: "Debflo",
    values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 15],
    initialValue: 0,
    leakStart: 4,
    leakMax: 12,
    ring: ["#8dcaf0", "#b9e4ff", "#78bce8"],
    pointer: ["#c4e8ff", "#4aaee8"],
    name: "O2"
  },
  Air: {
    brand: "Debflo",
    values: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15],
    initialValue: 0,
    leakStart: 4,
    leakMax: 12,
    ring: ["#9ca3af", "#e5e7eb", "#6b7280"],
    pointer: ["#f1f5f9", "#64748b"],
    name:"Air"
  },
  Aspi: {
    brand: "Debflo",
    values: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15],
    initialValue: 0,
    leakStart: 4,
    leakMax: 12,
    ring: ["#cdd37d", "#f7f4c8", "#a0a834"],
    pointer: ["#fafbd9", "#afb835"],
    name:"Aspi"
  },
};