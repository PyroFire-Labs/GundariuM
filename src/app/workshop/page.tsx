import type { Metadata } from "next";
import { WorkshopClient } from "@/components/workshop/WorkshopClient";

export const metadata: Metadata = {
  title: "Workshop | GundariuM",
  description: "Inspect your Gundar-Frame NFTs and prepare for repair or upgrade.",
};

export default function WorkshopPage() {
  return <WorkshopClient />;
}
