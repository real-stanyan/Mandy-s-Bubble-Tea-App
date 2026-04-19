import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/brand/Icon';
import { T, TYPE } from '@/constants/theme';

export type SectionHeadProps = {
  label: string;
  eyebrow?: string;
  count?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHead({ label, eyebrow, count, actionLabel, onAction }: SectionHeadProps) {
  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
      {eyebrow ? (
        <Text style={[TYPE.eyebrow, { color: T.brand, marginBottom: 4 }]}>{eyebrow}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[TYPE.screenTitleSm, { color: T.ink }]}>{label}</Text>
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[TYPE.bodyStrong, { color: T.brand }]}>{actionLabel}</Text>
            <Icon name="chevR" color={T.brand} size={14} />
          </Pressable>
        ) : count ? (
          <Text style={[TYPE.body, { color: T.ink3 }]}>{count}</Text>
        ) : null}
      </View>
    </View>
  );
}
