import { forwardRef } from 'react';
import type { CSSProperties, SVGProps, ForwardRefExoticComponent, RefAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TABAN_ICONS, TABAN_CATEGORY_ACCENTS } from './taban';
import {
  Activity, AlertTriangle, Apple, Archive, ArrowDownLeft, ArrowDownRight,
  ArrowRight, ArrowRightLeft, ArrowUpDown, ArrowUpRight, Baby, Ban, Bandage,
  Banknote, BarChart3, BedDouble, Bell, BellOff, Brain, Bug, Building2, Calendar,
  Camera, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  CircleDollarSign, Clipboard, ClipboardCheck, ClipboardList, Clock, CloudOff,
  Code2, Copy, Cpu, CreditCard, DollarSign, Download, Droplet, Edit2, ExternalLink,
  Eye, EyeOff, FileJson, FileSpreadsheet, FileText, FilePlus2, Flag,
  FlaskConical, FolderOpen, Gauge, Gift, GitBranch, GitCompare, Globe, HardDrive,
  HeartPulse, HelpCircle, History, Home, Hospital, Image as ImageIcon, Info,
  KeyRound, Keyboard, LayoutDashboard, Languages, Layers, LineChart, List, Loader2,
  Lock, LogIn, LogOut, Mail, MapPin, Maximize2, Menu, MessageSquare,
  Mic, MicOff, Microscope, Minus, Monitor, MonitorSmartphone, MoreVertical, Navigation,
  Network, Package, Paperclip, Pause, Phone, PhoneOff, PieChart, Pill, Play, Plus, QrCode,
  Radio, RefreshCw, Receipt, RotateCw, Save, Scale, Search, Send, Server, Settings,
  Settings2, Shield, ShieldAlert, ShoppingCart, Signal, Skull, Sparkles,
  Square, Star, Stethoscope, Sun, Syringe, Table2, Target, Thermometer,
  ThumbsUp, Timer, ToggleLeft, ToggleRight, Trash2, TrendingDown, TrendingUp, Truck,
  Upload, User, UserMinus, Users, Utensils, UtensilsCrossed, Video, Wallet,
  Wifi, WifiOff, Wind, X, Zap, ZapOff,
  Moon as LucideMoon, Palette as LucidePalette, Eye as EyeCam,
  FileUp as LucideFileUp,
} from 'lucide-react';

// Semantic pictorial icon system for TamamHealth EMR.
// Each IconName maps to a Lucide icon + a semantic color chosen to
// match what the icon represents (lungs pink, heart red, pill purple,
// thermometer orange, flask amber, etc). The default stroke-based
// Lucide icons are tinted inline so they read as small pictograms
// without the blue theme wash.
//
// Public API (size / color / accent / strokeWidth / style / className /
// ref) is unchanged so the rest of the codebase keeps compiling.
// `accent` overrides the semantic color when a caller needs to force
// a specific tint (e.g. category-tinted buttons).

export type IconName =
  // Clinical
  | 'chart' | 'patient' | 'stethoscope' | 'referral' | 'message'
  | 'calendar' | 'timeline' | 'record' | 'consultation' | 'triage'
  // Services
  | 'flask' | 'pill' | 'wallet' | 'prescription' | 'claim' | 'receipt'
  | 'creditCard' | 'mobileMoney' | 'diagnosis'
  // Vital events
  | 'vaccine' | 'pregnant' | 'baby' | 'skull' | 'surveillance' | 'mch'
  // Vitals
  | 'heart' | 'bloodPressure' | 'thermometer' | 'oxygen' | 'lungs'
  | 'weight' | 'pulse'
  // UI
  | 'building' | 'hospital' | 'wifi' | 'wifiOff' | 'cloudOff' | 'search' | 'alert'
  | 'chevronLeft' | 'chevronRight' | 'chevronDown' | 'chevronUp'
  | 'qr' | 'phone' | 'mapPin' | 'clock' | 'edit' | 'printer' | 'download'
  | 'shield' | 'sparkle' | 'check' | 'close' | 'menu' | 'bell'
  | 'moon' | 'sun' | 'globe' | 'settings' | 'logout' | 'user' | 'arrowRight'
  | 'arrowRightLeft' | 'plus' | 'video' | 'bug' | 'activity' | 'server'
  | 'barChart' | 'palette' | 'users' | 'gauge' | 'layoutDashboard'
  | 'fileText' | 'home'
  // Extended UI
  | 'apple' | 'archive' | 'arrowDownLeft' | 'arrowDownRight' | 'arrowUpDown'
  | 'arrowUpRight' | 'ban' | 'bandage' | 'banknote' | 'bedDouble' | 'bellOff'
  | 'brain' | 'camera' | 'code' | 'copy' | 'cpu' | 'dollarSign'
  | 'externalLink' | 'eye' | 'eyeOff' | 'fileJson' | 'fileSpreadsheet'
  | 'fileUp' | 'flag' | 'folderOpen' | 'gift' | 'gitBranch' | 'gitCompare'
  | 'hardDrive' | 'helpCircle' | 'history' | 'image' | 'info' | 'keyRound'
  | 'keyboard' | 'languages' | 'layers' | 'lineChart' | 'list' | 'loader'
  | 'lock' | 'logIn' | 'mail' | 'maximize' | 'mic' | 'micOff' | 'microscope'
  | 'minus' | 'monitorSmartphone' | 'moreVertical' | 'navigation' | 'network'
  | 'package' | 'paperclip' | 'pause' | 'phoneOff' | 'pieChart' | 'play'
  | 'radio' | 'refresh' | 'rotate' | 'save' | 'send' | 'sendHorizontal'
  | 'shoppingCart' | 'signal' | 'sliders' | 'square' | 'star' | 'table'
  | 'target' | 'thumbsUp' | 'timer' | 'toggleLeft' | 'toggleRight' | 'trash'
  | 'trendingDown' | 'trendingUp' | 'truck' | 'upload' | 'userX' | 'utensils'
  | 'utensilsCrossed' | 'wind' | 'zap' | 'zapOff';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'color' | 'ref'> {
  name: IconName;
  size?: number | string;
  /** Overrides the semantic color for this icon. */
  color?: string;
  /** Alias of `color` for backward compatibility. */
  accent?: string;
  strokeWidth?: number | string;
  style?: CSSProperties;
  ref?: React.Ref<SVGSVGElement>;
}

// Category accent colors — kept for library showcase tooling.
export const CATEGORY_ACCENTS: Record<string, string> = {
  clinical: '#3b82f6',
  services: '#E4A84B',
  'vital-events': '#D96E59',
  vitals: '#C44536',
  ui: '#5A7370',
};

// ───────────────────────────────────────────────────────────────────────────
// Semantic palette. One color per IconName chosen to match what the
// icon represents in a medical/clinical context. Anatomy colors lean
// toward body-part hues (lungs pink, heart red, brain mauve), services
// use category colors, UI controls use neutral gray, and warnings use
// the usual red/amber conventions.
// ───────────────────────────────────────────────────────────────────────────
const GRAY = '#5A7370';
const DARK = '#1e3a8a';

const ICON_COLORS: Record<IconName, string> = {
  // Clinical — teal/green family
  chart: '#6B5CC2',           // analytics purple
  patient: '#3b82f6',         // clinical teal
  stethoscope: '#3b82f6',
  referral: '#3b82f6',
  message: '#3b82f6',         // communication blue
  calendar: '#E4A84B',        // amber (time/schedule)
  timeline: '#8E6DD1',
  record: GRAY,
  consultation: '#3b82f6',
  triage: '#C44536',          // emergency red

  // Services
  flask: '#E4A84B',           // lab amber
  pill: '#8B5CF6',            // medicine purple
  wallet: '#B8741C',          // money bronze
  prescription: '#3b82f6',
  claim: '#3b82f6',
  receipt: GRAY,
  creditCard: '#3D5854',
  mobileMoney: '#B8741C',
  diagnosis: '#3b82f6',

  // Vital events
  vaccine: '#0EA5A4',         // vaccine teal
  pregnant: '#D96E59',        // maternal coral
  baby: '#E97999',            // baby pink
  skull: '#3D5854',           // neutral dark
  surveillance: '#8E6DD1',
  mch: '#D96E59',

  // Vitals — anatomical colors
  heart: '#C44536',           // crimson red
  bloodPressure: '#B33727',   // dark red
  thermometer: '#E07B3C',     // orange (heat)
  oxygen: '#4AA0D5',           // sky blue (O2)
  lungs: '#E97999',           // lung pink
  weight: '#5A7370',          // neutral
  pulse: '#C44536',           // red (pulse/beat)

  // UI — structural
  building: '#5A7370',        // my-facility uses neutral building
  hospital: '#C44536',         // red-cross hospital
  wifi: '#1B9E77',
  wifiOff: '#C44536',
  cloudOff: '#C44536',
  search: GRAY,
  alert: '#E4A84B',
  chevronLeft: GRAY,
  chevronRight: GRAY,
  chevronDown: GRAY,
  chevronUp: GRAY,
  qr: DARK,
  phone: '#3b82f6',
  mapPin: '#C44536',           // red pin
  clock: '#E4A84B',
  edit: GRAY,
  printer: GRAY,
  download: '#3b82f6',
  shield: '#3b82f6',
  sparkle: '#8B5CF6',         // AI purple
  check: '#1F9D6F',           // success green
  close: '#C44536',
  menu: GRAY,
  bell: '#E4A84B',
  moon: '#6B5CC2',            // night
  sun: '#E4A84B',
  globe: '#3b82f6',
  settings: GRAY,
  logout: GRAY,
  user: '#3b82f6',
  arrowRight: GRAY,
  arrowRightLeft: '#3b82f6',
  plus: GRAY,
  video: '#C44536',            // rec red
  bug: '#C44536',
  activity: '#C44536',         // heartrate red
  server: GRAY,
  barChart: '#6B5CC2',
  palette: '#D96E59',
  users: '#3b82f6',
  gauge: '#3b82f6',
  layoutDashboard: '#3b82f6',
  fileText: GRAY,
  home: '#3b82f6',

  // Extended UI
  apple: '#C44536',
  archive: GRAY,
  arrowDownLeft: GRAY,
  arrowDownRight: GRAY,
  arrowUpDown: GRAY,
  arrowUpRight: '#3b82f6',
  ban: '#C44536',
  bandage: '#D96E59',
  banknote: '#1F9D6F',
  bedDouble: '#3b82f6',
  bellOff: GRAY,
  brain: '#B7718E',           // mauve
  camera: DARK,
  code: '#3b82f6',
  copy: GRAY,
  cpu: '#3b82f6',
  dollarSign: '#1F9D6F',      // money green
  externalLink: '#3b82f6',
  eye: '#3b82f6',
  eyeOff: GRAY,
  fileJson: '#E4A84B',
  fileSpreadsheet: '#1F9D6F',
  fileUp: '#3b82f6',
  flag: '#C44536',
  folderOpen: '#E4A84B',
  gift: '#D96E59',
  gitBranch: '#3b82f6',
  gitCompare: '#3b82f6',
  hardDrive: GRAY,
  helpCircle: '#3b82f6',
  history: GRAY,
  image: '#D96E59',
  info: '#3b82f6',
  keyRound: '#E4A84B',
  keyboard: GRAY,
  languages: '#3b82f6',
  layers: '#3b82f6',
  lineChart: '#3b82f6',
  list: GRAY,
  loader: '#3b82f6',
  lock: DARK,
  logIn: '#3b82f6',
  mail: '#3b82f6',
  maximize: GRAY,
  mic: '#C44536',
  micOff: GRAY,
  microscope: '#8B5CF6',
  minus: GRAY,
  monitorSmartphone: '#3b82f6',
  moreVertical: GRAY,
  navigation: '#3b82f6',
  network: '#3b82f6',
  package: '#E4A84B',
  paperclip: GRAY,
  pause: GRAY,
  phoneOff: '#C44536',
  pieChart: '#6B5CC2',
  play: '#3b82f6',
  radio: '#3b82f6',
  refresh: '#3b82f6',
  rotate: GRAY,
  save: '#3b82f6',
  send: '#3b82f6',
  sendHorizontal: '#3b82f6',
  shoppingCart: '#E4A84B',
  signal: '#1F9D6F',
  sliders: GRAY,
  square: GRAY,
  star: '#E4A84B',
  table: GRAY,
  target: '#C44536',
  thumbsUp: '#1F9D6F',
  timer: '#E4A84B',
  toggleLeft: GRAY,
  toggleRight: '#3b82f6',
  trash: '#C44536',
  trendingDown: '#C44536',
  trendingUp: '#1F9D6F',
  truck: '#E4A84B',
  upload: '#3b82f6',
  userX: '#C44536',
  utensils: '#E4A84B',
  utensilsCrossed: '#C44536',
  wind: '#3b82f6',
  zap: '#E4A84B',
  zapOff: GRAY,
};

// ───────────────────────────────────────────────────────────────────────────
// Lucide component per IconName. Chosen to visually represent the
// underlying concept. `hospital` and `building` are intentionally
// different (Hospital vs Building2) so "Hospital Network" and "My
// Facility" don't render with the same glyph.
// ───────────────────────────────────────────────────────────────────────────
const ICON_COMPONENTS: Record<IconName, LucideIcon> = {
  chart: BarChart3, patient: User, stethoscope: Stethoscope, referral: ArrowRightLeft,
  message: MessageSquare, calendar: Calendar, timeline: History, record: FilePlus2,
  consultation: Stethoscope, triage: ShieldAlert,

  flask: FlaskConical, pill: Pill, wallet: Wallet, prescription: ClipboardList,
  claim: ClipboardCheck, receipt: Receipt, creditCard: CreditCard,
  mobileMoney: CircleDollarSign, diagnosis: Clipboard,

  vaccine: Syringe, pregnant: Baby, baby: Baby, skull: Skull, surveillance: EyeCam,
  mch: Baby,

  heart: HeartPulse, bloodPressure: Gauge, thermometer: Thermometer, oxygen: Droplet,
  lungs: Wind, weight: Scale, pulse: Activity,

  building: Building2, hospital: Hospital, wifi: Wifi, wifiOff: WifiOff,
  cloudOff: CloudOff, search: Search, alert: AlertTriangle, chevronLeft: ChevronLeft,
  chevronRight: ChevronRight, chevronDown: ChevronDown, chevronUp: ChevronUp,
  qr: QrCode, phone: Phone, mapPin: MapPin, clock: Clock, edit: Edit2,
  printer: Monitor, download: Download, shield: Shield, sparkle: Sparkles,
  check: Check, close: X, menu: Menu, bell: Bell, moon: LucideMoon, sun: Sun,
  globe: Globe, settings: Settings, logout: LogOut, user: User, arrowRight: ArrowRight,
  arrowRightLeft: ArrowRightLeft, plus: Plus, video: Video, bug: Bug, activity: Activity,
  server: Server, barChart: BarChart3, palette: LucidePalette, users: Users,
  gauge: Gauge, layoutDashboard: LayoutDashboard, fileText: FileText, home: Home,

  apple: Apple, archive: Archive, arrowDownLeft: ArrowDownLeft, arrowDownRight: ArrowDownRight,
  arrowUpDown: ArrowUpDown, arrowUpRight: ArrowUpRight, ban: Ban, bandage: Bandage,
  banknote: Banknote, bedDouble: BedDouble, bellOff: BellOff, brain: Brain,
  camera: Camera, code: Code2, copy: Copy, cpu: Cpu, dollarSign: DollarSign,
  externalLink: ExternalLink, eye: Eye, eyeOff: EyeOff, fileJson: FileJson,
  fileSpreadsheet: FileSpreadsheet, fileUp: LucideFileUp, flag: Flag, folderOpen: FolderOpen,
  gift: Gift, gitBranch: GitBranch, gitCompare: GitCompare, hardDrive: HardDrive,
  helpCircle: HelpCircle, history: History, image: ImageIcon, info: Info, keyRound: KeyRound,
  keyboard: Keyboard, languages: Languages, layers: Layers, lineChart: LineChart,
  list: List, loader: Loader2, lock: Lock, logIn: LogIn, mail: Mail, maximize: Maximize2,
  mic: Mic, micOff: MicOff, microscope: Microscope, minus: Minus,
  monitorSmartphone: MonitorSmartphone, moreVertical: MoreVertical, navigation: Navigation,
  network: Network, package: Package, paperclip: Paperclip, pause: Pause,
  phoneOff: PhoneOff, pieChart: PieChart, play: Play, radio: Radio, refresh: RefreshCw,
  rotate: RotateCw, save: Save, send: Send, sendHorizontal: Send, shoppingCart: ShoppingCart,
  signal: Signal, sliders: Settings2, square: Square, star: Star, table: Table2,
  target: Target, thumbsUp: ThumbsUp, timer: Timer, toggleLeft: ToggleLeft,
  toggleRight: ToggleRight, trash: Trash2, trendingDown: TrendingDown, trendingUp: TrendingUp,
  truck: Truck, upload: Upload, userX: UserMinus,
  utensils: Utensils, utensilsCrossed: UtensilsCrossed, wind: Wind, zap: Zap, zapOff: ZapOff,
};

// ───────────────────────────────────────────────────────────────────────────
// Public component — renders a Lucide icon in its semantic color.
// ───────────────────────────────────────────────────────────────────────────
export function Icon({
  name,
  size = 20,
  color,
  accent,
  strokeWidth = 1.8,
  style,
  ref,
  className,
  ...rest
}: IconProps) {
  const ariaLabel = (rest as { 'aria-label'?: string })['aria-label'];
  const ariaHidden = (rest as { 'aria-hidden'?: boolean | 'true' | 'false' })['aria-hidden'];
  const onClick = (rest as { onClick?: React.MouseEventHandler<SVGSVGElement> }).onClick;
  const numericSize = typeof size === 'string' ? Number(size) || 20 : size;

  // First: render via the Taban illustrated library when available.
  const tabanEntry = TABAN_ICONS[name];
  if (tabanEntry) {
    const TabanComp = tabanEntry.Component as (p: TabanRenderProps) => React.ReactNode;
    const tabanAccent =
      color || accent || TABAN_CATEGORY_ACCENTS[tabanEntry.category].base;
    return (
      <TabanComp
        size={numericSize}
        accent={tabanAccent}
        className={className}
        style={{ color: tabanAccent, flexShrink: 0, ...style }}
        data-icon={name}
        aria-label={ariaLabel}
        aria-hidden={ariaHidden ?? (ariaLabel ? undefined : true)}
        onClick={onClick}
      />
    );
  }

  // Fallback: lucide rendering for icons not yet covered by Taban.
  const Lu = ICON_COMPONENTS[name];
  if (!Lu) return null;
  const chosen = color || accent || ICON_COLORS[name] || GRAY;
  const sw = typeof strokeWidth === 'string' ? Number(strokeWidth) || 1.8 : strokeWidth;
  return (
    <Lu
      ref={ref as React.Ref<SVGSVGElement>}
      size={numericSize}
      color={chosen}
      strokeWidth={sw}
      className={className}
      // Setting `color` inline (not just via prop) guarantees the global
      // `svg.lucide:not([style*="color"])` default doesn't re-paint us.
      style={{ color: chosen, flexShrink: 0, ...style }}
      data-icon={name}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden ?? (ariaLabel ? undefined : true)}
      onClick={onClick}
    />
  );
}

type TabanRenderProps = {
  size?: number;
  accent?: string;
  className?: string;
  style?: CSSProperties;
  'data-icon'?: string;
  'aria-label'?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  onClick?: React.MouseEventHandler<SVGSVGElement>;
};

// Metadata for library showcase / palette tooling — unchanged.
export const ICONS: Record<IconName, { name: string; category: string }> = {
  chart: { name: 'Dashboard chart', category: 'clinical' },
  patient: { name: 'Patient', category: 'clinical' },
  stethoscope: { name: 'Stethoscope', category: 'clinical' },
  referral: { name: 'Referral', category: 'clinical' },
  message: { name: 'Message', category: 'clinical' },
  calendar: { name: 'Calendar', category: 'clinical' },
  timeline: { name: 'Timeline', category: 'clinical' },
  record: { name: 'Record', category: 'clinical' },
  consultation: { name: 'Consultation', category: 'clinical' },
  triage: { name: 'Triage', category: 'clinical' },
  flask: { name: 'Lab flask', category: 'services' },
  pill: { name: 'Pill', category: 'services' },
  wallet: { name: 'Wallet', category: 'services' },
  prescription: { name: 'Prescription', category: 'services' },
  claim: { name: 'Claim', category: 'services' },
  receipt: { name: 'Receipt', category: 'services' },
  creditCard: { name: 'Credit card', category: 'services' },
  mobileMoney: { name: 'Mobile money', category: 'services' },
  diagnosis: { name: 'Diagnosis', category: 'services' },
  vaccine: { name: 'Vaccine', category: 'vital-events' },
  pregnant: { name: 'Antenatal', category: 'vital-events' },
  baby: { name: 'Birth', category: 'vital-events' },
  skull: { name: 'Death', category: 'vital-events' },
  surveillance: { name: 'Surveillance', category: 'vital-events' },
  mch: { name: 'MCH', category: 'vital-events' },
  heart: { name: 'Heart', category: 'vitals' },
  bloodPressure: { name: 'Blood pressure', category: 'vitals' },
  thermometer: { name: 'Temperature', category: 'vitals' },
  oxygen: { name: 'SpO₂', category: 'vitals' },
  lungs: { name: 'Lungs', category: 'vitals' },
  weight: { name: 'Weight', category: 'vitals' },
  pulse: { name: 'Pulse', category: 'vitals' },
  building: { name: 'My facility', category: 'ui' },
  hospital: { name: 'Hospital', category: 'ui' },
  wifi: { name: 'Online', category: 'ui' },
  wifiOff: { name: 'Offline', category: 'ui' },
  cloudOff: { name: 'Local only', category: 'ui' },
  search: { name: 'Search', category: 'ui' },
  alert: { name: 'Alert', category: 'ui' },
  chevronLeft: { name: 'Chevron left', category: 'ui' },
  chevronRight: { name: 'Chevron right', category: 'ui' },
  chevronDown: { name: 'Chevron down', category: 'ui' },
  chevronUp: { name: 'Chevron up', category: 'ui' },
  qr: { name: 'QR code', category: 'ui' },
  phone: { name: 'Phone', category: 'ui' },
  mapPin: { name: 'Location', category: 'ui' },
  clock: { name: 'Clock', category: 'ui' },
  edit: { name: 'Edit', category: 'ui' },
  printer: { name: 'Print', category: 'ui' },
  download: { name: 'Download', category: 'ui' },
  shield: { name: 'Shield', category: 'ui' },
  sparkle: { name: 'AI / Sparkle', category: 'ui' },
  check: { name: 'Check', category: 'ui' },
  close: { name: 'Close', category: 'ui' },
  menu: { name: 'Menu', category: 'ui' },
  bell: { name: 'Notifications', category: 'ui' },
  moon: { name: 'Dark mode', category: 'ui' },
  sun: { name: 'Light mode', category: 'ui' },
  globe: { name: 'Globe', category: 'ui' },
  settings: { name: 'Settings', category: 'ui' },
  logout: { name: 'Logout', category: 'ui' },
  user: { name: 'User', category: 'ui' },
  arrowRight: { name: 'Arrow right', category: 'ui' },
  arrowRightLeft: { name: 'Arrows exchange', category: 'ui' },
  plus: { name: 'Plus', category: 'ui' },
  video: { name: 'Telehealth', category: 'ui' },
  bug: { name: 'Epidemic', category: 'ui' },
  activity: { name: 'Activity', category: 'ui' },
  server: { name: 'System', category: 'ui' },
  barChart: { name: 'Reports', category: 'ui' },
  palette: { name: 'Branding', category: 'ui' },
  users: { name: 'Users', category: 'ui' },
  gauge: { name: 'Dashboard', category: 'ui' },
  layoutDashboard: { name: 'Layout', category: 'ui' },
  fileText: { name: 'File', category: 'ui' },
  home: { name: 'Home', category: 'ui' },
  apple: { name: 'Apple', category: 'ui' },
  archive: { name: 'Archive', category: 'ui' },
  arrowDownLeft: { name: 'Arrow down-left', category: 'ui' },
  arrowDownRight: { name: 'Arrow down-right', category: 'ui' },
  arrowUpDown: { name: 'Arrow up-down', category: 'ui' },
  arrowUpRight: { name: 'Arrow up-right', category: 'ui' },
  ban: { name: 'Ban', category: 'ui' },
  bandage: { name: 'Bandage', category: 'ui' },
  banknote: { name: 'Banknote', category: 'services' },
  bedDouble: { name: 'Bed', category: 'clinical' },
  bellOff: { name: 'Bell off', category: 'ui' },
  brain: { name: 'Brain', category: 'clinical' },
  camera: { name: 'Camera', category: 'ui' },
  code: { name: 'Code', category: 'ui' },
  copy: { name: 'Copy', category: 'ui' },
  cpu: { name: 'CPU', category: 'ui' },
  dollarSign: { name: 'Dollar', category: 'services' },
  externalLink: { name: 'External link', category: 'ui' },
  eye: { name: 'Eye', category: 'ui' },
  eyeOff: { name: 'Eye off', category: 'ui' },
  fileJson: { name: 'File · JSON', category: 'ui' },
  fileSpreadsheet: { name: 'File · Sheet', category: 'ui' },
  fileUp: { name: 'File upload', category: 'ui' },
  flag: { name: 'Flag', category: 'ui' },
  folderOpen: { name: 'Folder', category: 'ui' },
  gift: { name: 'Gift', category: 'ui' },
  gitBranch: { name: 'Git branch', category: 'ui' },
  gitCompare: { name: 'Git compare', category: 'ui' },
  hardDrive: { name: 'Hard drive', category: 'ui' },
  helpCircle: { name: 'Help', category: 'ui' },
  history: { name: 'History', category: 'ui' },
  image: { name: 'Image', category: 'ui' },
  info: { name: 'Info', category: 'ui' },
  keyRound: { name: 'Key', category: 'ui' },
  keyboard: { name: 'Keyboard', category: 'ui' },
  languages: { name: 'Languages', category: 'ui' },
  layers: { name: 'Layers', category: 'ui' },
  lineChart: { name: 'Line chart', category: 'ui' },
  list: { name: 'List', category: 'ui' },
  loader: { name: 'Loader', category: 'ui' },
  lock: { name: 'Lock', category: 'ui' },
  logIn: { name: 'Log in', category: 'ui' },
  mail: { name: 'Mail', category: 'ui' },
  maximize: { name: 'Maximize', category: 'ui' },
  mic: { name: 'Mic', category: 'ui' },
  micOff: { name: 'Mic off', category: 'ui' },
  microscope: { name: 'Microscope', category: 'clinical' },
  minus: { name: 'Minus', category: 'ui' },
  monitorSmartphone: { name: 'Devices', category: 'ui' },
  moreVertical: { name: 'More', category: 'ui' },
  navigation: { name: 'Navigation', category: 'ui' },
  network: { name: 'Network', category: 'ui' },
  package: { name: 'Package', category: 'ui' },
  paperclip: { name: 'Attachment', category: 'ui' },
  pause: { name: 'Pause', category: 'ui' },
  phoneOff: { name: 'Phone off', category: 'ui' },
  pieChart: { name: 'Pie chart', category: 'ui' },
  play: { name: 'Play', category: 'ui' },
  radio: { name: 'Radio', category: 'ui' },
  refresh: { name: 'Refresh', category: 'ui' },
  rotate: { name: 'Rotate', category: 'ui' },
  save: { name: 'Save', category: 'ui' },
  send: { name: 'Send', category: 'ui' },
  sendHorizontal: { name: 'Send', category: 'ui' },
  shoppingCart: { name: 'Cart', category: 'services' },
  signal: { name: 'Signal', category: 'ui' },
  sliders: { name: 'Filters', category: 'ui' },
  square: { name: 'Square', category: 'ui' },
  star: { name: 'Star', category: 'ui' },
  table: { name: 'Table', category: 'ui' },
  target: { name: 'Target', category: 'ui' },
  thumbsUp: { name: 'Thumbs up', category: 'ui' },
  timer: { name: 'Timer', category: 'ui' },
  toggleLeft: { name: 'Toggle · off', category: 'ui' },
  toggleRight: { name: 'Toggle · on', category: 'ui' },
  trash: { name: 'Trash', category: 'ui' },
  trendingDown: { name: 'Trending down', category: 'ui' },
  trendingUp: { name: 'Trending up', category: 'ui' },
  truck: { name: 'Truck', category: 'ui' },
  upload: { name: 'Upload', category: 'ui' },
  userX: { name: 'User · remove', category: 'ui' },
  utensils: { name: 'Utensils', category: 'ui' },
  utensilsCrossed: { name: 'Utensils crossed', category: 'ui' },
  wind: { name: 'Wind', category: 'ui' },
  zap: { name: 'Zap', category: 'ui' },
  zapOff: { name: 'Zap off', category: 'ui' },
};

// ───────────────────────────────────────────────────────────────────────────
// Lucide-compatible wrappers — kept unchanged so existing call sites
// that import `DuotoneX` (or the lucide shim) keep working.
// ───────────────────────────────────────────────────────────────────────────
type LucideCompatProps = Omit<SVGProps<SVGSVGElement>, 'color'> & {
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
  absoluteStrokeWidth?: boolean;
};

type LucideCompatIcon = ForwardRefExoticComponent<
  Omit<LucideCompatProps, 'ref'> & RefAttributes<SVGSVGElement>
>;

function makeLucide(iconName: IconName, ..._unused: unknown[]): LucideCompatIcon {
  void _unused;
  const C = forwardRef<SVGSVGElement, LucideCompatProps>(function DuotoneComp(props, ref) {
    const { size, className, color, strokeWidth } = props;
    return (
      <Icon
        name={iconName}
        size={size}
        color={color}
        strokeWidth={strokeWidth}
        className={className}
        ref={ref}
      />
    );
  });
  C.displayName = `Duotone.${iconName}`;
  return C;
}

// Clinical
export const DuotoneChart = makeLucide('chart');
export const DuotonePatient = makeLucide('patient');
export const DuotoneStethoscope = makeLucide('stethoscope');
export const DuotoneReferral = makeLucide('referral');
export const DuotoneMessage = makeLucide('message');
export const DuotoneCalendar = makeLucide('calendar');
export const DuotoneTimeline = makeLucide('timeline');
export const DuotoneConsultation = makeLucide('consultation');
export const DuotoneRecord = makeLucide('record');

// Services
export const DuotoneFlask = makeLucide('flask');
export const DuotonePill = makeLucide('pill');
export const DuotoneWallet = makeLucide('wallet');
export const DuotonePrescription = makeLucide('prescription');
export const DuotoneClaim = makeLucide('claim');
export const DuotoneReceipt = makeLucide('receipt');
export const DuotoneCreditCard = makeLucide('creditCard');
export const DuotoneMobileMoney = makeLucide('mobileMoney');
export const DuotoneDiagnosis = makeLucide('diagnosis');

// Vital events
export const DuotoneVaccine = makeLucide('vaccine');
export const DuotonePregnant = makeLucide('pregnant');
export const DuotoneBaby = makeLucide('baby');
export const DuotoneSkull = makeLucide('skull');
export const DuotoneSurveillance = makeLucide('surveillance');
export const DuotoneMCH = makeLucide('mch');

// Vitals
export const DuotoneHeart = makeLucide('heart');
export const DuotoneBloodPressure = makeLucide('bloodPressure');
export const DuotoneThermometer = makeLucide('thermometer');
export const DuotoneOxygen = makeLucide('oxygen');
export const DuotoneLungs = makeLucide('lungs');
export const DuotoneWeight = makeLucide('weight');
export const DuotonePulse = makeLucide('pulse');

// UI
export const DuotoneBuilding = makeLucide('building');
export const DuotoneHospital = makeLucide('hospital');
export const DuotoneWifi = makeLucide('wifi');
export const DuotoneWifiOff = makeLucide('wifiOff');
export const DuotoneCloudOff = makeLucide('cloudOff');
export const DuotoneSearch = makeLucide('search');
export const DuotoneAlert = makeLucide('alert');
export const DuotoneChevronLeft = makeLucide('chevronLeft');
export const DuotoneChevronRight = makeLucide('chevronRight');
export const DuotoneChevronDown = makeLucide('chevronDown');
export const DuotoneChevronUp = makeLucide('chevronUp');
export const DuotoneQR = makeLucide('qr');
export const DuotonePhone = makeLucide('phone');
export const DuotoneMapPin = makeLucide('mapPin');
export const DuotoneClock = makeLucide('clock');
export const DuotoneEdit = makeLucide('edit');
export const DuotonePrinter = makeLucide('printer');
export const DuotoneDownload = makeLucide('download');
export const DuotoneShield = makeLucide('shield');
export const DuotoneSparkle = makeLucide('sparkle');
export const DuotoneCheck = makeLucide('check');
export const DuotoneClose = makeLucide('close');
export const DuotoneMenu = makeLucide('menu');
export const DuotoneBell = makeLucide('bell');
export const DuotoneMoon = makeLucide('moon');
export const DuotoneSun = makeLucide('sun');
export const DuotoneGlobe = makeLucide('globe');
export const DuotoneSettings = makeLucide('settings');
export const DuotoneLogout = makeLucide('logout');
export const DuotoneUser = makeLucide('user');
export const DuotoneArrowRight = makeLucide('arrowRight');
export const DuotoneArrowRightLeft = makeLucide('arrowRightLeft');
export const DuotonePlus = makeLucide('plus');
export const DuotoneVideo = makeLucide('video');
export const DuotoneBug = makeLucide('bug');
export const DuotoneActivity = makeLucide('activity');
export const DuotoneServer = makeLucide('server');
export const DuotoneBarChart = makeLucide('barChart');
export const DuotonePalette = makeLucide('palette');
export const DuotoneUsers = makeLucide('users');
export const DuotoneGauge = makeLucide('gauge');
export const DuotoneLayoutDashboard = makeLucide('layoutDashboard');
export const DuotoneFileText = makeLucide('fileText');
export const DuotoneHome = makeLucide('home');

// Extended UI
export const DuotoneApple = makeLucide('apple');
export const DuotoneArchive = makeLucide('archive');
export const DuotoneArrowDownLeft = makeLucide('arrowDownLeft');
export const DuotoneArrowDownRight = makeLucide('arrowDownRight');
export const DuotoneArrowUpDown = makeLucide('arrowUpDown');
export const DuotoneArrowUpRight = makeLucide('arrowUpRight');
export const DuotoneBan = makeLucide('ban');
export const DuotoneBandage = makeLucide('bandage');
export const DuotoneBanknote = makeLucide('banknote');
export const DuotoneBedDouble = makeLucide('bedDouble');
export const DuotoneBellOff = makeLucide('bellOff');
export const DuotoneBrain = makeLucide('brain');
export const DuotoneCamera = makeLucide('camera');
export const DuotoneCode = makeLucide('code');
export const DuotoneCopy = makeLucide('copy');
export const DuotoneCpu = makeLucide('cpu');
export const DuotoneDollarSign = makeLucide('dollarSign');
export const DuotoneExternalLink = makeLucide('externalLink');
export const DuotoneEye = makeLucide('eye');
export const DuotoneEyeOff = makeLucide('eyeOff');
export const DuotoneFileJson = makeLucide('fileJson');
export const DuotoneFileSpreadsheet = makeLucide('fileSpreadsheet');
export const DuotoneFileUp = makeLucide('fileUp');
export const DuotoneFlag = makeLucide('flag');
export const DuotoneFolderOpen = makeLucide('folderOpen');
export const DuotoneGift = makeLucide('gift');
export const DuotoneGitBranch = makeLucide('gitBranch');
export const DuotoneGitCompare = makeLucide('gitCompare');
export const DuotoneHardDrive = makeLucide('hardDrive');
export const DuotoneHelpCircle = makeLucide('helpCircle');
export const DuotoneHistory = makeLucide('history');
export const DuotoneImage = makeLucide('image');
export const DuotoneInfo = makeLucide('info');
export const DuotoneKeyRound = makeLucide('keyRound');
export const DuotoneKeyboard = makeLucide('keyboard');
export const DuotoneLanguages = makeLucide('languages');
export const DuotoneLayers = makeLucide('layers');
export const DuotoneLineChart = makeLucide('lineChart');
export const DuotoneList = makeLucide('list');
export const DuotoneLoader = makeLucide('loader');
export const DuotoneLock = makeLucide('lock');
export const DuotoneLogIn = makeLucide('logIn');
export const DuotoneMail = makeLucide('mail');
export const DuotoneMaximize = makeLucide('maximize');
export const DuotoneMic = makeLucide('mic');
export const DuotoneMicOff = makeLucide('micOff');
export const DuotoneMicroscope = makeLucide('microscope');
export const DuotoneMinus = makeLucide('minus');
export const DuotoneMonitorSmartphone = makeLucide('monitorSmartphone');
export const DuotoneMoreVertical = makeLucide('moreVertical');
export const DuotoneNavigation = makeLucide('navigation');
export const DuotoneNetwork = makeLucide('network');
export const DuotonePackage = makeLucide('package');
export const DuotonePaperclip = makeLucide('paperclip');
export const DuotonePause = makeLucide('pause');
export const DuotonePhoneOff = makeLucide('phoneOff');
export const DuotonePieChart = makeLucide('pieChart');
export const DuotonePlay = makeLucide('play');
export const DuotoneRadio = makeLucide('radio');
export const DuotoneRefresh = makeLucide('refresh');
export const DuotoneRotate = makeLucide('rotate');
export const DuotoneSave = makeLucide('save');
export const DuotoneSend = makeLucide('send');
export const DuotoneSendHorizontal = makeLucide('sendHorizontal');
export const DuotoneShoppingCart = makeLucide('shoppingCart');
export const DuotoneSignal = makeLucide('signal');
export const DuotoneSliders = makeLucide('sliders');
export const DuotoneSquare = makeLucide('square');
export const DuotoneStar = makeLucide('star');
export const DuotoneTable = makeLucide('table');
export const DuotoneTarget = makeLucide('target');
export const DuotoneThumbsUp = makeLucide('thumbsUp');
export const DuotoneTimer = makeLucide('timer');
export const DuotoneToggleLeft = makeLucide('toggleLeft');
export const DuotoneToggleRight = makeLucide('toggleRight');
export const DuotoneTrash = makeLucide('trash');
export const DuotoneTrendingDown = makeLucide('trendingDown');
export const DuotoneTrendingUp = makeLucide('trendingUp');
export const DuotoneTruck = makeLucide('truck');
export const DuotoneUpload = makeLucide('upload');
export const DuotoneUserX = makeLucide('userX');
export const DuotoneUtensils = makeLucide('utensils');
export const DuotoneUtensilsCrossed = makeLucide('utensilsCrossed');
export const DuotoneWind = makeLucide('wind');
export const DuotoneZap = makeLucide('zap');
export const DuotoneZapOff = makeLucide('zapOff');

export default Icon;
