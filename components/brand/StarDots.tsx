import React from 'react';
import { View, StyleSheet } from 'react-native';
import { T } from '@/constants/theme';

export type StarDotsProps = {
  value: number;
  total?: number;
  size?: number;
  gap?: number;
  filledColor?: string;
  emptyColor?: string;
};

export function StarDots({
  value,
  total = 9,
  size = 12,
  gap = 6,
  filledColor = T.star,
  emptyColor = T.ink4,
}: StarDotsProps) {
  const clamped = Math.max(0, Math.min(value, total));
  return (
    <View style={[styles.row, { gap }]}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: i < clamped ? filledColor : emptyColor,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
