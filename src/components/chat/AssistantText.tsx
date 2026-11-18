import React from 'react';
import { Text, View, StyleSheet, Linking, ScrollView, Pressable, Platform, type TextStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { publicSourceUrl } from '@/types/execution';
import { responseBlocks } from '@/lib/responseBlocks';
import { useAppTheme } from '@/context/ThemeContext';
import { showToast } from '@/context/ToastContext';

/** Native text only: source HTML never executes, even inside streamed Markdown. */
export function AssistantText({ text, color, linkColor }: { text: string; color: string; linkColor: string }) {
  const { colors } = useAppTheme();
  const open = (url: string) => { void Linking.openURL(url).catch(() => showToast('This source could not open.')); };
  const inline = (line: string) => line.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\(https:\/\/[^\s)]+\)|https:\/\/[^\s<>]+)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <Text key={index} style={{ fontWeight: '700' }}>{part.slice(2, -2)}</Text>;
    if (part.startsWith('*') && part.endsWith('*')) return <Text key={index} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>;
    if (part.startsWith('`') && part.endsWith('`')) return <Text key={index} style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: colors.surfaceMuted }}>{part.slice(1, -1)}</Text>;
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/);
    const url = publicSourceUrl(link?.[2] || (part.startsWith('https://') ? part.replace(/[.,;!?]+$/, '') : undefined));
    if (url) return <Text key={index} accessibilityRole="link" style={{ color: linkColor, textDecorationLine: 'underline' }} onPress={() => open(url.href)}>{link?.[1] || part}</Text>;
    return part;
  });
  const highlight = (code: string) => code.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:const|let|var|function|return|if|else|import|from|export|async|await|class|def|True|False|null|true|false)\b|\b\d+(?:\.\d+)?\b|\/\/[^\n]*)/g).map((token, index) => <Text key={index} style={{ color: /^['"]/.test(token) ? colors.success : /^(\/\/)/.test(token) ? colors.textMuted : /^(const|let|var|function|return|if|else|import|from|export|async|await|class|def|True|False|null|true|false)$/.test(token) ? colors.primaryLight : color }}>{token}</Text>);
  return <View style={styles.content}>{responseBlocks(text).map((block, index) => {
    if (block.kind === 'code') return <View key={index} style={[styles.code, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}><View style={styles.codeHeader}><Text style={[styles.caption, { color: colors.textSecondary }]}>{block.language}</Text><Pressable accessibilityRole="button" accessibilityLabel="Copy code" style={styles.copy} onPress={() => { void Clipboard.setStringAsync(block.text).then(() => showToast('Copied code')); }}><Text style={[styles.caption, { color: linkColor }]}>Copy code</Text></Pressable></View><ScrollView horizontal contentContainerStyle={{ padding: 14 }}><Text selectable style={[styles.mono, { color }]}>{highlight(block.text)}</Text></ScrollView></View>;
    if (block.kind === 'table') return <ScrollView key={index} horizontal style={[styles.table, { borderColor: colors.border }]}><View accessibilityLabel="Response table"><View style={[styles.tableRow, { backgroundColor: colors.surfaceMuted }]}>{block.headers.map((cell, col) => <Text key={col} style={[styles.cell, { color, fontWeight: '700' }]}>{inline(cell)}</Text>)}</View>{block.rows.map((row, rowIndex) => <View key={rowIndex} style={[styles.tableRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>{block.headers.map((_, col) => <Text selectable key={col} style={[styles.cell, { color }]}>{inline(row[col] || '')}</Text>)}</View>)}</View></ScrollView>;
    const line = block.text;
    if (!line.trim()) return <View key={index} style={{ height: 6 }} />;
    const check = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const quote = line.match(/^>\s?(.*)$/);
    const style: TextStyle = { color, ...(heading ? { fontWeight: '700', fontSize: heading[1].length < 3 ? 21 : 18, marginTop: 12, lineHeight: 28 } : {}), ...(quote ? { color: colors.textSecondary, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: 12 } : {}) };
    return <Text selectable key={index} accessibilityRole={heading ? 'header' : undefined} style={[styles.line, style]}>{check ? (check[1].toLowerCase() === 'x' ? '\u2611 ' : '\u2610 ') : bullet ? '\u2022 ' : ''}{inline(check?.[2] || bullet?.[1] || heading?.[2] || quote?.[1] || line || ' ')}</Text>;
  })}</View>;
}
const styles = StyleSheet.create({ content: { gap: 4, minWidth: 0, maxWidth: '100%' }, line: { fontSize: 17, lineHeight: 26, letterSpacing: -0.2 }, code: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginVertical: 8 }, codeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14 }, caption: { fontSize: 12, fontWeight: '600' }, copy: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 }, mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, lineHeight: 21 }, table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, marginVertical: 10 }, tableRow: { flexDirection: 'row' }, cell: { width: 160, padding: 12, fontSize: 14, lineHeight: 21 } });
