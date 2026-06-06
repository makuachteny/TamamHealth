import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

type Props = {
  size?: number;
  /** Mark color. Defaults to Tamam brand primary green. */
  color?: string;
};

/**
 * Tamam Healthcare System brand mark — the ascending dot cluster.
 * Geometry taken from the official style guide (June 2026), rendered in
 * brand green (#0d8844). Square, scales to `size`.
 */
export default function TamamHealthLogo({ size = 120, color = '#0d8844' }: Props) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg viewBox="90 -11 316 316" width={size} height={size}>
        <G fill={color}>
          <Circle cx="127.67" cy="28.84" r="28.84" />
          <Circle cx="218.69" cy="46.28" r="28.84" />
          <Circle cx="296.1" cy="97.22" r="28.84" />
          <Circle cx="348.12" cy="173.91" r="28.84" />
          <Circle cx="366.84" cy="264.67" r="28.84" />
          <Circle cx="130.25" cy="103.54" r="24.99" />
          <Circle cx="192.48" cy="116.29" r="24.99" />
          <Circle cx="245.1" cy="151.87" r="24.99" />
          <Circle cx="280.09" cy="204.88" r="24.99" />
          <Circle cx="292.14" cy="267.26" r="24.99" />
          <Circle cx="129.41" cy="171.67" r="14.53" />
          <Circle cx="165.64" cy="178.9" r="14.53" />
          <Circle cx="196.34" cy="199.45" r="14.53" />
          <Circle cx="216.83" cy="230.18" r="14.53" />
          <Circle cx="224.01" cy="266.42" r="14.53" />
          <Circle cx="129.38" cy="213.9" r="8.05" />
          <Circle cx="149.44" cy="217.9" r="8.05" />
          <Circle cx="166.45" cy="229.28" r="8.05" />
          <Circle cx="177.81" cy="246.31" r="8.05" />
          <Circle cx="181.78" cy="266.38" r="8.05" />
        </G>
      </Svg>
    </View>
  );
}
