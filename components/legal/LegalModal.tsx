import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { LEGAL_CONTENT, type LegalKind } from '@/lib/legal'

const tokens = {
  bg: '#ECEBE6',
  surface: '#FFFFFF',
  ink: '#141413',
  ink2: '#3A3A37',
  ink3: 'rgba(20,20,19,0.55)',
  line: 'rgba(20,20,19,0.10)',
}
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' })

export function LegalModal({
  visible,
  kind,
  onClose,
}: {
  visible: boolean
  kind: LegalKind
  onClose: () => void
}) {
  const doc = LEGAL_CONTENT[kind]
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{doc.title}</Text>
            <Text style={styles.meta}>{doc.company} · {doc.lastUpdated}</Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path
                d="M6 6l12 12M18 6L6 18"
                stroke={tokens.ink2}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {doc.sections.map((section, i) => (
            <View key={i} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              {section.paragraphs.map((p, j) => (
                <Text key={j} style={styles.paragraph}>{p}</Text>
              ))}
              {section.bullets?.map((b, j) => (
                <View key={j} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.line,
  },
  title: {
    fontFamily: SERIF,
    fontWeight: '500',
    fontSize: 24,
    letterSpacing: -0.6,
    color: tokens.ink,
  },
  meta: { marginTop: 4, fontSize: 12, color: tokens.ink3 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(20,20,19,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 24, paddingTop: 16 },
  section: { marginBottom: 20 },
  sectionHeading: {
    fontFamily: SERIF,
    fontWeight: '600',
    fontSize: 17,
    color: tokens.ink,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: tokens.ink2,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    paddingLeft: 4,
  },
  bulletDot: { color: tokens.ink3, fontSize: 14, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 22, color: tokens.ink2 },
})
