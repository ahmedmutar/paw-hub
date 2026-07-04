import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../theme'

export type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange' | 'teal' | 'purple'

const variantStyles: Record<BadgeVariant, { bg: string; fg: string }> = {
  teal: { bg: colors.tealLt, fg: colors.teal },
  yellow: { bg: colors.yellowLt, fg: '#C98A00' },
  red: { bg: colors.redLt, fg: colors.red },
  blue: { bg: colors.blueLt, fg: colors.blue },
  green: { bg: colors.greenLt, fg: colors.green },
  orange: { bg: colors.orangeLt, fg: colors.orangeDk },
  purple: { bg: colors.purpleLt, fg: colors.purple },
  gray: { bg: colors.warmBg, fg: colors.textSoft },
}

export function Badge({ children, variant = 'gray' }: { children: string; variant?: BadgeVariant }) {
  const s = variantStyles[variant]
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '700' },
})
