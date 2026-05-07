import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  TABAN_ICONS,
  TABAN_CATEGORY_ACCENTS,
  type TabanIconName,
} from './taban';

// Drop-in replacement for `<Ionicons name=... size=... color=... />`.
// Where an Ionicons name maps to a Taban illustrated icon, render that;
// otherwise fall back to Ionicons.

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export type IconName = IoniconsName | TabanIconName;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.ComponentProps<typeof Ionicons>['style'];
}

// Ionicons name → Taban registry key. Anything not listed renders via Ionicons.
const IONICONS_TO_TABAN: Record<string, TabanIconName> = {
  add: 'plus',
  'alert-circle': 'alert',
  'analytics-outline': 'chart',
  'arrow-back': 'arrowLeft',
  'arrow-forward': 'chevronRight',
  'arrow-forward-circle-outline': 'chevronRight',
  'body-outline': 'patient',
  'business-outline': 'building',
  'calendar-outline': 'calendar',
  'call-outline': 'phone',
  'card-outline': 'creditCard',
  'chatbubbles-outline': 'message',
  'checkmark-circle': 'check',
  'checkmark-circle-outline': 'check',
  'chevron-forward': 'chevronRight',
  'create-outline': 'edit',
  'document-text-outline': 'record',
  'eyedrop-outline': 'syringe',
  'flask-outline': 'flask',
  heart: 'heart',
  'hourglass-outline': 'clock',
  'id-card-outline': 'record',
  'male-female-outline': 'patient',
  'medkit-outline': 'pill',
  'person-outline': 'patient',
  'shield-checkmark': 'shield',
  'shield-checkmark-outline': 'shield',
  'time-outline': 'clock',
  wallet: 'wallet',
};

export function Icon({ name, size = 24, color, style }: IconProps) {
  // Direct Taban name?
  if (typeof name === 'string' && name in TABAN_ICONS) {
    const entry = TABAN_ICONS[name];
    const accent = color || TABAN_CATEGORY_ACCENTS[entry.category].base;
    const Comp = entry.Component;
    return (
      <View style={style}>
        <Comp size={size} accent={accent} />
      </View>
    );
  }

  // Ionicons name with a Taban mapping?
  const tabanKey =
    typeof name === 'string' ? IONICONS_TO_TABAN[name] : undefined;
  if (tabanKey) {
    const entry = TABAN_ICONS[tabanKey];
    const accent = color || TABAN_CATEGORY_ACCENTS[entry.category].base;
    const Comp = entry.Component;
    return (
      <View style={style}>
        <Comp size={size} accent={accent} />
      </View>
    );
  }

  // Fall back to Ionicons.
  return (
    <Ionicons
      name={name as IoniconsName}
      size={size}
      color={color}
      style={style}
    />
  );
}
