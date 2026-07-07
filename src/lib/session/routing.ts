import type { Role } from "@/lib/types";

export function homeForRole(role: Role) {
  return role === "atleta" ? "/dashboard" : "/gestao";
}
