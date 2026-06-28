"use client";

import type { CSSProperties, SVGProps } from "react";
import { Icon as PlatformIcon } from "@/components/icons";
import type { IconName as PlatformIconName } from "@/components/icons";

/* ═══════════════════════════════════════════════════════════════════
   TamamHealth Marketing — platform icon adapter

   The website uses the exact same icon renderer and semantic icon names from:
   platform/src/components/icons/Icon.tsx

   Marketing names stay supported here so existing website pages do not need
   to know the platform's internal icon vocabulary.
   ═══════════════════════════════════════════════════════════════════ */

export type IconName =
  | "check" | "x" | "info" | "arrow-right" | "chevron-down" | "chevron-up"
  | "plus" | "minus" | "external" | "search" | "star" | "heart"
  | "download" | "upload" | "settings" | "menu" | "network" | "radio"
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

const MARKETING_TO_PLATFORM_ICON: Record<IconName, PlatformIconName> = {
  check: "check",
  x: "close",
  info: "info",
  "arrow-right": "arrowRight",
  "chevron-down": "chevronDown",
  "chevron-up": "chevronUp",
  plus: "plus",
  minus: "minus",
  external: "externalLink",
  search: "search",
  star: "star",
  heart: "heart",
  download: "download",
  upload: "upload",
  settings: "settings",
  menu: "menu",
  network: "network",
  radio: "radio",
  hospital: "hospital",
  clinic: "building",
  lab: "flask",
  microscope: "microscope",
  imaging: "qr",
  pharmacy: "pill",
  pill: "pill",
  syringe: "vaccine",
  stethoscope: "stethoscope",
  ambulance: "truck",
  doctor: "stethoscope",
  nurse: "user",
  patient: "patient",
  "heart-pulse": "pulse",
  "health-data": "activity",
  prescription: "prescription",
  dna: "cpu",
  ehr: "fileText",
  tablet: "monitorSmartphone",
  phone: "phone",
  laptop: "monitorSmartphone",
  cloud: "server",
  offline: "cloudOff",
  sync: "refresh",
  database: "server",
  lock: "lock",
  shield: "shield",
  chart: "barChart",
  analytics: "barChart",
  dashboard: "layoutDashboard",
  api: "code",
  code: "code",
  book: "fileText",
  document: "fileText",
  notes: "record",
  folder: "folderOpen",
  calendar: "calendar",
  clock: "clock",
  bell: "bell",
  message: "message",
  video: "video",
  billing: "creditCard",
  money: "dollarSign",
  receipt: "receipt",
  email: "mail",
  globe: "globe",
  africa: "globe",
  users: "users",
  handshake: "thumbsUp",
  award: "sparkle",
  target: "target",
  rocket: "sparkle",
  lightbulb: "sparkle",
  "shield-check": "shield",
  warning: "alert",
  map: "navigation",
  location: "mapPin",
};

type DuoIconProps = Omit<SVGProps<SVGSVGElement>, "color" | "name"> & {
  name: IconName;
  size?: number | string;
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
  style,
  className,
  ...rest
}: DuoIconProps) {
  return (
    <PlatformIcon
      name={MARKETING_TO_PLATFORM_ICON[name]}
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      style={style}
      className={className}
      {...rest}
    />
  );
}

export default DuoIcon;
