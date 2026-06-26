"use client";

import type { CSSProperties, SVGProps } from "react";
import {
  Activity, AlertTriangle, Ambulance, ArrowRight, Award, BarChart3, Bell,
  BookOpen, Building2, Calendar, Check, ChevronDown, ChevronUp, Clock, Cloud,
  CloudOff, Code2, CreditCard, Database, Dna, DollarSign, Download,
  ExternalLink, FileText, FolderOpen, Globe, Handshake, Heart, HeartPulse,
  Hospital, Info, Laptop, LayoutDashboard, Lightbulb, Lock, Mail, Map,
  MapPin, Menu, MessageSquare, Microscope, Minus, Notebook, Pill, Plus,
  Receipt, RefreshCw, Rocket, ScanLine, Search, Settings, Shield, ShieldCheck,
  Smartphone, Star, Stethoscope, Syringe, Tablet, Target, Upload, User, Users,
  Video, X,
  FlaskConical, ClipboardList,
  type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Marketing — Icon wrapper

   Mirrors the platform's lucide-react + semantic-color approach so
   marketing and product surfaces share the same visual language.

   Public API is a drop-in replacement for the previous DuoIcon:
       <DuoIcon name="hospital" size={44} />

   Brand logos (python, linkedin, etc.) still use @iconify/react
   directly at the call site.
   ═══════════════════════════════════════════════════════════════════ */

export type IconName =
  | "check" | "x" | "info" | "arrow-right" | "chevron-down" | "chevron-up"
  | "plus" | "minus" | "external" | "search" | "star" | "heart"
  | "download" | "upload" | "settings" | "menu"
  | "hospital" | "clinic" | "lab" | "microscope" | "imaging" | "pharmacy"
  | "pill" | "syringe" | "stethoscope" | "ambulance" | "doctor" | "nurse"
  | "patient" | "heart-pulse" | "health-data" | "prescription" | "dna"
  | "ehr" | "tablet" | "phone" | "laptop" | "cloud" | "offline" | "sync"
  | "database" | "lock" | "shield" | "chart" | "analytics" | "dashboard"
  | "api" | "code" | "book" | "document" | "notes" | "folder" | "calendar"
  | "clock" | "bell" | "message" | "video" | "billing" | "money" | "receipt"
  | "email" | "globe" | "africa" | "users" | "handshake" | "award"
  | "target" | "rocket" | "lightbulb" | "shield-check" | "warning"
  | "map" | "location";

// Palette — matches platform/src/components/icons/Icon.tsx
const TEAL = "#1B7FA8";
const RED = "#C44536";
const AMBER = "#E4A84B";
const PURPLE = "#8B5CF6";
const GREEN = "#1F9D6F";
const DARK = "#1E3A8A";
const GRAY = "#5A7370";

const ICON_COMPONENTS: Record<IconName, LucideIcon> = {
  // UI generics
  check: Check, x: X, info: Info,
  "arrow-right": ArrowRight, "chevron-down": ChevronDown, "chevron-up": ChevronUp,
  plus: Plus, minus: Minus, external: ExternalLink, search: Search,
  star: Star, heart: Heart, download: Download, upload: Upload,
  settings: Settings, menu: Menu,

  // Healthcare
  hospital: Hospital, clinic: Building2, lab: FlaskConical, microscope: Microscope,
  imaging: ScanLine, pharmacy: Pill, pill: Pill, syringe: Syringe,
  stethoscope: Stethoscope, ambulance: Ambulance, doctor: Stethoscope, nurse: User,
  patient: User, "heart-pulse": HeartPulse, "health-data": Activity,
  prescription: ClipboardList, dna: Dna,

  // Tech / Platform
  ehr: FileText, tablet: Tablet, phone: Smartphone, laptop: Laptop,
  cloud: Cloud, offline: CloudOff, sync: RefreshCw, database: Database,
  lock: Lock, shield: Shield, chart: BarChart3, analytics: BarChart3,
  dashboard: LayoutDashboard, api: Code2, code: Code2, book: BookOpen,
  document: FileText, notes: Notebook, folder: FolderOpen, calendar: Calendar,
  clock: Clock, bell: Bell, message: MessageSquare, video: Video,
  billing: CreditCard, money: DollarSign, receipt: Receipt, email: Mail,
  globe: Globe, africa: Globe, users: Users, handshake: Handshake,
  award: Award, target: Target, rocket: Rocket, lightbulb: Lightbulb,
  "shield-check": ShieldCheck, warning: AlertTriangle, map: Map, location: MapPin,
};

const ICON_COLORS: Record<IconName, string> = {
  // UI generics
  check: GREEN, x: RED, info: TEAL,
  "arrow-right": GRAY, "chevron-down": GRAY, "chevron-up": GRAY,
  plus: GRAY, minus: GRAY, external: TEAL, search: GRAY,
  star: AMBER, heart: RED, download: TEAL, upload: TEAL,
  settings: GRAY, menu: GRAY,

  // Healthcare
  hospital: RED, clinic: TEAL, lab: AMBER, microscope: PURPLE,
  imaging: TEAL, pharmacy: PURPLE, pill: PURPLE, syringe: TEAL,
  stethoscope: TEAL, ambulance: RED, doctor: TEAL, nurse: TEAL,
  patient: TEAL, "heart-pulse": RED, "health-data": RED,
  prescription: TEAL, dna: TEAL,

  // Tech / Platform
  ehr: TEAL, tablet: TEAL, phone: TEAL, laptop: TEAL,
  cloud: TEAL, offline: RED, sync: TEAL, database: GRAY,
  lock: DARK, shield: TEAL, chart: PURPLE, analytics: PURPLE,
  dashboard: TEAL, api: TEAL, code: TEAL, book: TEAL,
  document: GRAY, notes: GRAY, folder: AMBER, calendar: AMBER,
  clock: AMBER, bell: AMBER, message: TEAL, video: RED,
  billing: TEAL, money: GREEN, receipt: GRAY, email: TEAL,
  globe: TEAL, africa: TEAL, users: TEAL, handshake: AMBER,
  award: AMBER, target: RED, rocket: TEAL, lightbulb: AMBER,
  "shield-check": TEAL, warning: AMBER, map: TEAL, location: RED,
};

type DuoIconProps = Omit<SVGProps<SVGSVGElement>, "color" | "name"> & {
  name: IconName;
  size?: number | string;
  /** Override the semantic color. */
  color?: string;
  strokeWidth?: number | string;
  style?: CSSProperties;
  className?: string;
};


export function DuoIcon({
  name,
  size = 32,
  color,
  strokeWidth = 1.8,
  className,
  style,
  ...rest
}: DuoIconProps) {
  const numericSize = typeof size === "string" ? Number(size) || 32 : size;
  const ariaLabel = (rest as { "aria-label"?: string })["aria-label"];

  // Clean, consistent line icons via lucide-react (shared with the platform).
  const Lu = ICON_COMPONENTS[name];
  if (!Lu) return null;
  const chosen = color || ICON_COLORS[name] || GRAY;
  const sw = typeof strokeWidth === "string" ? Number(strokeWidth) || 1.8 : strokeWidth;
  return (
    <Lu
      size={numericSize}
      color={chosen}
      strokeWidth={sw}
      className={className}
      style={{ color: chosen, display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
      data-icon={name}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    />
  );
}

export default DuoIcon;
