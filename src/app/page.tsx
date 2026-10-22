import { InventoryApp } from "@/components/inventory-app";
import { jarvisAvailability } from "@/lib/provider";

export const dynamic = "force-dynamic";

export default function Home() {
  return <InventoryApp aiAvailable={jarvisAvailability()} />;
}
