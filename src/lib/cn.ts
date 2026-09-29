import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Junta classes e resolve conflitos do Tailwind: a última vence. Sem isso,
 * `<Card className="p-0">` continuava com o `p-5` padrão do Card, porque as
 * duas classes iam para o HTML e o CSS decidia pela ordem do arquivo.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
