import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { T } from '@/constants/theme';

export type IconName =
  | 'bag' | 'bell' | 'pin' | 'star'
  | 'arrow' | 'arrowL' | 'plus' | 'check'
  | 'search' | 'close'
  | 'home' | 'cafe' | 'receipt' | 'user'
  | 'qr' | 'clock'
  | 'chevR' | 'logout' | 'gift' | 'cup' | 'settings' | 'share'
  | 'apple' | 'google' | 'card' | 'wallet';

export type IconProps = {
  name: IconName;
  color?: string;
  size?: number;
  /** For icons that take a filled variant (home). */
  filled?: boolean;
};

export function Icon({ name, color, size, filled }: IconProps) {
  switch (name) {
    case 'bag': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M5 8h14l-1.3 11.2a2 2 0 01-2 1.8H8.3a2 2 0 01-2-1.8L5 8z" stroke={c} strokeWidth={1.7} strokeLinejoin="round" />
          <Path d="M9 8V6a3 3 0 016 0v2" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'bell': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M6 10a6 6 0 0112 0v4l1.5 3h-15L6 14v-4z" stroke={c} strokeWidth={1.7} strokeLinejoin="round" />
          <Path d="M10 20a2 2 0 004 0" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'pin': {
      const c = color ?? T.ink;
      const s = size ?? 14;
      return (
        <Svg width={s} height={s * 1.25} viewBox="0 0 14 18" fill="none">
          <Path d="M7 1c3.3 0 6 2.6 6 5.8C13 11 7 17 7 17S1 11 1 6.8C1 3.6 3.7 1 7 1z" stroke={c} strokeWidth={1.4} />
          <Circle cx={7} cy={7} r={2} fill={c} />
        </Svg>
      );
    }
    case 'star': {
      const c = color ?? T.star;
      const s = size ?? 14;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" fill={c} />
        </Svg>
      );
    }
    case 'arrow': {
      const c = color ?? T.ink;
      const s = size ?? 14;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12h14M13 6l6 6-6 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'arrowL': {
      const c = color ?? T.ink;
      const s = size ?? 14;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M19 12H5M11 6l-6 6 6 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'plus': {
      const c = color ?? '#fff';
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke={c} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'check': {
      const c = color ?? '#fff';
      const s = size ?? 14;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={c} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'search': {
      const c = color ?? T.ink3;
      const s = size ?? 18;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={11} cy={11} r={7} stroke={c} strokeWidth={1.7} />
          <Path d="M20 20l-3.5-3.5" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'close': {
      const c = color ?? T.ink3;
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'home': {
      const c = color ?? T.ink;
      const s = size ?? 24;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" fill={filled ? c : 'none'} />
        </Svg>
      );
    }
    case 'cafe': {
      const c = color ?? T.ink;
      const s = size ?? 24;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M4 10h13v6a4 4 0 01-4 4H8a4 4 0 01-4-4v-6z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M17 12h2a2 2 0 010 4h-2" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M8 4s-1 1.5 0 3M12 4s-1 1.5 0 3" stroke={c} strokeWidth={1.4} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'receipt': {
      const c = color ?? T.ink;
      const s = size ?? 24;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M9 8h6M9 12h6M9 16h4" stroke={c} strokeWidth={1.4} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'user': {
      const c = color ?? T.ink;
      const s = size ?? 24;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={3.5} stroke={c} strokeWidth={1.6} />
          <Path d="M4.5 20a7.5 7.5 0 0115 0" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'qr': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={3} width={7} height={7} stroke={c} strokeWidth={1.6} />
          <Rect x={14} y={3} width={7} height={7} stroke={c} strokeWidth={1.6} />
          <Rect x={3} y={14} width={7} height={7} stroke={c} strokeWidth={1.6} />
          <Rect x={6} y={6} width={1.5} height={1.5} fill={c} />
          <Rect x={17} y={6} width={1.5} height={1.5} fill={c} />
          <Rect x={6} y={17} width={1.5} height={1.5} fill={c} />
          <Path d="M14 14h2v2h-2zM18 14h3M14 18h2v3M19 17v4M17 21h4" stroke={c} strokeWidth={1.4} />
        </Svg>
      );
    }
    case 'clock': {
      const c = color ?? T.ink;
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={1.6} />
          <Path d="M12 7v5l3 2" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'chevR': {
      const c = color ?? T.ink3;
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M9 6l6 6-6 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'logout': {
      const c = color ?? T.ink2;
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M16 8l4 4-4 4M20 12H10" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'gift': {
      const c = color ?? T.ink;
      const s = size ?? 18;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M3 10h18v3H3zM4 13h16v8H4zM12 10v11" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M12 10s-4-5-6-3 2 3 6 3zM12 10s4-5 6-3-2 3-6 3z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
        </Svg>
      );
    }
    case 'cup': {
      const c = color ?? T.ink;
      const s = size ?? 16;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M7 4h10l-1 16a2 2 0 01-2 2h-4a2 2 0 01-2-2L7 4z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M7 8h10" stroke={c} strokeWidth={1.4} />
        </Svg>
      );
    }
    case 'settings': {
      const c = color ?? T.ink;
      const s = size ?? 18;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={3} stroke={c} strokeWidth={1.6} />
          <Path d="M12 3v2M12 19v2M21 12h-2M5 12H3M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4L17 17M7 7L5.6 5.6" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'share': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3 L7 8 M12 3 L17 8 M12 3 V15"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M5 13 V19 Q5 21 7 21 H17 Q19 21 19 19 V13"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    }
    case 'apple': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
          <Path d="M17.5 12c-.1-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7 1.4 0 1.8.7 3 .7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.4-.9-2.7-3.4z" />
        </Svg>
      );
    }
    case 'google': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24">
          <Path d="M21.35 11.1h-9.17v2.9h5.27c-.23 1.45-1.69 4.26-5.27 4.26-3.17 0-5.75-2.62-5.75-5.86 0-3.23 2.58-5.86 5.75-5.86 1.8 0 3.02.77 3.71 1.43l2.53-2.44C16.82 3.93 14.68 3 12.18 3 7.52 3 3.73 6.79 3.73 11.4s3.79 8.4 8.45 8.4c4.88 0 8.11-3.43 8.11-8.26 0-.55-.06-.98-.14-1.44z" fill={c} />
        </Svg>
      );
    }
    case 'card': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M3 6.5C3 5.12 4.12 4 5.5 4h13C19.88 4 21 5.12 21 6.5v11c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 20 3 18.88 3 17.5v-11Z" stroke={c} strokeWidth={1.7} />
          <Path d="M3 9.5h18" stroke={c} strokeWidth={1.7} />
          <Path d="M6.5 15.5h3" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
        </Svg>
      );
    }
    case 'wallet': {
      const c = color ?? T.ink;
      const s = size ?? 20;
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M3 8.5C3 7.12 4.12 6 5.5 6h13C19.88 6 21 7.12 21 8.5v9c0 1.38-1.12 2.5-2.5 2.5h-13C4.12 20 3 18.88 3 17.5v-9Z" stroke={c} strokeWidth={1.7} />
          <Path d="M16 13.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" fill={c} />
        </Svg>
      );
    }
  }
}
