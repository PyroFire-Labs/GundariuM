import type { Metadata } from "next";
import galleryCards from "../../../public/gallery/cards.json";
import { WorkshopClient } from "@/components/workshop/WorkshopClient";
import { buildWorkshopFrame, type GalleryCard } from "@/lib/workshop/catalog";

export const metadata: Metadata = {
  title: "Workshop | GundariuM",
  description: "Inspect virtual Gundar-Frame assembly data and simulated specifications.",
};

export default function WorkshopPage() {
  const frames = (galleryCards as GalleryCard[]).map(buildWorkshopFrame);

  return <WorkshopClient frames={frames} />;
}
