// Place this file at: frontend/src/app/flowmeter/page.tsx
import type { Metadata } from "next";
import FlowmeterCard from "../../components/FlowmeterCard";
import AspiCard from "../../components/AspiCard";
import { ASPI_MODELS } from "../../data/aspiModels"
import { FLOWMETER_MODELS } from "../../data/flowmeterModels";
import styles from "../../styles/flowmeter.module.css";

export const metadata: Metadata = {
  title: "Simulateurs debitmetre O2",
};

const DISPLAYED_MODES = ["O2", "Air"] as const;
const ASPI_MODE = ["AspiSelect"] as const;

export default function FlowmeterPage() {
  return (
    <main className={styles.pageShell}>
      <div className={styles.flowmeterGrid}>
        {DISPLAYED_MODES.map((mode) => (
          <FlowmeterCard key={mode} model={FLOWMETER_MODELS[mode]} />
        ))}
        {ASPI_MODE.map((mode) => (
          <AspiCard key={mode} model={ASPI_MODELS[mode]} />
        ))}
      </div>
    </main>
  );
}