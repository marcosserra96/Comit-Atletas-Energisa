import { GestaoShell } from "@/components/layout/GestaoShell";

export default function GestaoLayout({ children }: { children: React.ReactNode }) {
  return <GestaoShell>{children}</GestaoShell>;
}
