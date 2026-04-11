import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';

interface ListItemProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  rightText?: string;
  rightBadge?: { text: string; color: string; bg: string };
  onPress?: () => void;
}

export default function ListItem({ icon, iconColor, title, subtitle, rightText, rightBadge, onPress }: ListItemProps) {
  const { colors, borderRadius, typography, spacing } = useAppTheme();

  return (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.divider }]} onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: (iconColor || colors.primary) + '18', borderRadius: borderRadius.md }]}>
          <Ionicons name={icon} size={20} color={iconColor || colors.primary} />
        </View>
      )}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text.primary, fontSize: typography.fontSize.body }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.text.tertiary, fontSize: typography.fontSize.small }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {rightText ? <Text style={[styles.rightText, { color: colors.text.secondary, fontSize: typography.fontSize.body }]}>{rightText}</Text> : null}
      {rightBadge ? (
        <View style={[styles.badge, { backgroundColor: rightBadge.bg, borderRadius: borderRadius.full }]}>
          <Text style={[styles.badgeText, { color: rightBadge.color, fontSize: typography.fontSize.xs }]}>{rightBadge.text}</Text>
        </View>
      ) : null}
      {onPress && <Ionicons name="chevron-forward" size={18} color={colors.text.light} style={{ marginLeft: 8 }} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  iconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  content: { flex: 1 },
  title: { fontWeight: '500' },
  subtitle: { marginTop: 2 },
  rightText: { fontWeight: '600', marginLeft: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8 },
  badgeText: { fontWeight: '600' },
});
