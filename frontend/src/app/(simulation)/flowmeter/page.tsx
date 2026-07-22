import type { Metadata } from "next";
import PageHeader from "../../components/PageHeader";
import FlowmeterCard from "../../components/FlowmeterCard";
import AspiCard from "../../components/AspiCard";
import { ASPI_MODELS } from "../../data/aspiModels";
import { FLOWMETER_MODELS } from "../../data/flowmeterModels";

export const metadata: Metadata = {
  title: "Simulateurs debitmetre O2",
};

const DISPLAYED_MODES = ["O2", "Air"] as const;
const ASPI_MODE = ["AspiSelect"] as const;

export default function FlowmeterPage() {
  return (
    <main className="h-screen bg-black text-white flex flex-col items-center font-sans overflow-hidden">
      {/*<PageHeader title="Débitmètres & Aspiration" icon="💨" />*/}
      <div className="flex-1 p-8 max-w-6xl w-full flex flex-col items-center justify-center">
        <div className="sim-device-grid">
          {DISPLAYED_MODES.map((mode) => (
            <FlowmeterCard key={mode} model={FLOWMETER_MODELS[mode]} />
          ))}
          {ASPI_MODE.map((mode) => (
            <AspiCard key={mode} model={ASPI_MODELS[mode]} />
          ))}
        </div>
      </div>
    </main>
  );
}