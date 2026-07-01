"use client";

import { forwardRef } from "react";
import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";
import DuoIcon from "./DuoIcon";
import type { IconName } from "./DuoIcon";

export type LucideIcon = ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, "ref" | "color"> & {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  } & RefAttributes<SVGSVGElement>
>;

type IconProps = Omit<Parameters<typeof DuoIcon>[0], "name">;

function createIcon(name: IconName, displayName: string): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, IconProps>((props, _ref) => {
    void _ref;
    return <DuoIcon name={name} {...props} />;
  }) as LucideIcon;
  Icon.displayName = displayName;
  return Icon;
}

export const Activity = createIcon("health-data", "Activity");
export const AlertTriangle = createIcon("warning", "AlertTriangle");
export const Ambulance = createIcon("ambulance", "Ambulance");
export const ArrowRight = createIcon("arrow-right", "ArrowRight");
export const Award = createIcon("award", "Award");
export const BarChart3 = createIcon("analytics", "BarChart3");
export const Bell = createIcon("bell", "Bell");
export const BadgeCheck = createIcon("shield-check", "BadgeCheck");
export const BookOpen = createIcon("book", "BookOpen");
export const Building2 = createIcon("clinic", "Building2");
export const Calendar = createIcon("calendar", "Calendar");
export const Check = createIcon("check", "Check");
export const ChevronDown = createIcon("chevron-down", "ChevronDown");
export const ChevronUp = createIcon("chevron-up", "ChevronUp");
export const ClipboardList = createIcon("prescription", "ClipboardList");
export const Clock = createIcon("clock", "Clock");
export const Cloud = createIcon("cloud", "Cloud");
export const CloudOff = createIcon("offline", "CloudOff");
export const Code2 = createIcon("code", "Code2");
export const CreditCard = createIcon("billing", "CreditCard");
export const Database = createIcon("database", "Database");
export const Dna = createIcon("dna", "Dna");
export const DollarSign = createIcon("money", "DollarSign");
export const Download = createIcon("download", "Download");
export const ExternalLink = createIcon("external", "ExternalLink");
export const FileText = createIcon("document", "FileText");
export const FlaskConical = createIcon("lab", "FlaskConical");
export const FolderOpen = createIcon("folder", "FolderOpen");
export const Globe = createIcon("globe", "Globe");
export const Handshake = createIcon("handshake", "Handshake");
export const Heart = createIcon("heart", "Heart");
export const HeartPulse = createIcon("heart-pulse", "HeartPulse");
export const Hospital = createIcon("hospital", "Hospital");
export const Info = createIcon("info", "Info");
export const Laptop = createIcon("laptop", "Laptop");
export const LayoutDashboard = createIcon("dashboard", "LayoutDashboard");
export const Lightbulb = createIcon("lightbulb", "Lightbulb");
export const Lock = createIcon("lock", "Lock");
export const Mail = createIcon("email", "Mail");
export const Map = createIcon("map", "Map");
export const MapPin = createIcon("location", "MapPin");
export const Menu = createIcon("menu", "Menu");
export const MessageSquare = createIcon("message", "MessageSquare");
export const Microscope = createIcon("microscope", "Microscope");
export const Minus = createIcon("minus", "Minus");
export const Notebook = createIcon("notes", "Notebook");
export const Network = createIcon("network", "Network");
export const Pill = createIcon("pill", "Pill");
export const Plus = createIcon("plus", "Plus");
export const Receipt = createIcon("receipt", "Receipt");
export const RadioTower = createIcon("radio", "RadioTower");
export const RefreshCw = createIcon("sync", "RefreshCw");
export const Rocket = createIcon("rocket", "Rocket");
export const ScanLine = createIcon("imaging", "ScanLine");
export const Search = createIcon("search", "Search");
export const Settings = createIcon("settings", "Settings");
export const Shield = createIcon("shield", "Shield");
export const ShieldCheck = createIcon("shield-check", "ShieldCheck");
export const Smartphone = createIcon("phone", "Smartphone");
export const Star = createIcon("star", "Star");
export const Stethoscope = createIcon("stethoscope", "Stethoscope");
export const Syringe = createIcon("syringe", "Syringe");
export const Tablet = createIcon("tablet", "Tablet");
export const Target = createIcon("target", "Target");
export const Upload = createIcon("upload", "Upload");
export const User = createIcon("patient", "User");
export const Users = createIcon("users", "Users");
export const Video = createIcon("video", "Video");
export const X = createIcon("x", "X");
