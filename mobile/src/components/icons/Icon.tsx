import React from 'react';
import { Ionicons } from '@expo/vector-icons';

// Drop-in replacement for `<Ionicons name=... size=... color=... />`.
// Keep mobile icons as simple blue outline glyphs to match the platform
// sidebar icon style.

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export type IconName = IoniconsName;

const BLUE_LINE_ICON = '#2191D0';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.ComponentProps<typeof Ionicons>['style'];
}

export function Icon({ name, size = 24, color, style }: IconProps) {
  return (
    <Ionicons
      name={name as IoniconsName}
      size={size}
      color={color || BLUE_LINE_ICON}
      style={style}
    />
  );
}
