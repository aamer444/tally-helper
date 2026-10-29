import type { LucideIcon } from "lucide-react";
import {
  BookText,
  Building2,
  FileText,
  History,
  House,
  Landmark,
  LayoutTemplate,
  RefreshCw,
  Settings,
  Sheet,
  ShieldCheck,
  ShoppingBasket,
  ShoppingCart,
  Waypoints,
} from "lucide-react";

export type PageId =
  | "home"
  | "sales"
  | "purchase"
  | "bank"
  | "notes"
  | "journals"
  | "workspace"
  | "masters"
  | "sync"
  | "history"
  | "audit"
  | "templates"
  | "rules"
  | "settings";

export interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  { items: [{ id: "home", label: "Home", icon: House }] },
  {
    title: "Import & Create",
    items: [
      { id: "sales", label: "Sales", icon: ShoppingCart },
      { id: "purchase", label: "Purchase", icon: ShoppingBasket },
      { id: "bank", label: "Bank Statements", icon: Landmark },
      { id: "notes", label: "Credit / Debit Notes", icon: FileText },
      { id: "journals", label: "Journal Entries", icon: BookText },
    ],
  },
  {
    title: "Company",
    items: [
      { id: "workspace", label: "Company Workspace", icon: Building2 },
      { id: "masters", label: "Tally Data", icon: Sheet },
      { id: "sync", label: "Sync from Tally", icon: RefreshCw },
    ],
  },
  {
    title: "Reports",
    items: [
      { id: "history", label: "Import History", icon: History },
      { id: "audit", label: "Audit Log", icon: ShieldCheck },
    ],
  },
  {
    title: "Setup",
    items: [
      { id: "templates", label: "Import Templates", icon: LayoutTemplate },
      { id: "rules", label: "Mapping Rules", icon: Waypoints },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

export function navLabel(id: PageId): string {
  return NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.id === id)?.label ?? "";
}
