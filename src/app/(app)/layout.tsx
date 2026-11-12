import { StoreProvider } from "@/lib/store";
import { AppGate } from "@/components/app/app-gate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <AppGate>{children}</AppGate>
    </StoreProvider>
  );
}
