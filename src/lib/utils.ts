import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Utilitaire Shadcn/UI : fusionne les classes Tailwind sans conflit */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
