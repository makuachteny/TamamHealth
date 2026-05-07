import React from 'react';
import { View } from 'react-native';
import Svg, {
  Circle, Rect, Polygon, Path, Defs, LinearGradient, Stop,
} from 'react-native-svg';

type Props = {
  size?: number;
};

export default function TamamHealthLogo({ size = 120 }: Props) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg viewBox="0 0 120 120" width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#E4A84B" />
            <Stop offset="50%" stopColor="#2D9B6A" />
            <Stop offset="100%" stopColor="#2E9E7E" />
          </LinearGradient>
        </Defs>

        {/* Outer dark circle */}
        <Circle cx="60" cy="60" r="58" fill="#1E4D4A" />
        <Circle cx="60" cy="60" r="54" fill="#1A3A3A" />

        {/* Gradient ring */}
        <Circle cx="60" cy="60" r="50" fill="none" stroke="url(#ringGrad)" strokeWidth="3" />

        {/* Star background (faint gold) */}
        <Polygon
          points="60,18 65,38 86,38 69,49 75,68 60,56 45,68 51,49 34,38 55,38"
          fill="#E4A84B"
          opacity="0.15"
        />

        {/* Cross (white backing) */}
        <Rect x="48" y="30" width="24" height="60" rx="4" fill="white" />
        <Rect x="30" y="48" width="60" height="24" rx="4" fill="white" />

        {/* Cross (green fill) */}
        <Rect x="52" y="34" width="16" height="52" rx="2" fill="#2D9B6A" />
        <Rect x="34" y="52" width="52" height="16" rx="2" fill="#2D9B6A" />

        {/* Center gold circle */}
        <Circle cx="60" cy="60" r="10" fill="#E4A84B" />

        {/* Star in center */}
        <Polygon
          points="60,52 62.2,57.6 68,57.6 63.4,61.2 65.2,67 60,63.6 54.8,67 56.6,61.2 52,57.6 57.8,57.6"
          fill="#1A3A3A"
        />

        {/* South Sudan flag stripes */}
        <Path d="M30,88 Q60,96 90,88" stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <Path d="M32,92 Q60,100 88,92" stroke="#E52E42" strokeWidth="2" fill="none" strokeLinecap="round" />
        <Path d="M35,96 Q60,103 85,96" stroke="#2D9B6A" strokeWidth="2" fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
