/**
 * ToolCard Component ('src/components/tools/ToolCard.tsx')
 *
 * List item row for tool connections:
 * - Bundled provider marks, with a backend logo URL fallback for unknown providers
 * - Tool Name and connected status / account subtitle
 * - Connect / Pending / Connected / Manage / Disconnect buttons
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Settings02Icon } from '@/constants/icons';
import { useAppTheme } from '@/context/ThemeContext';
import type { ColorPalette } from '@/constants/colors';

import { ToolWithConnection } from '@/types/tools';
import { getProvider } from '@/constants/providers';
import { ProviderLogo } from './ProviderLogo';

export interface ToolCardProps {
  attempt?: { url?: string; expiresAt?: string; error?: string };
  tool: ToolWithConnection;
  isLoading?: boolean;
  onConnect?: (tool: ToolWithConnection) => void;
  onDisconnect?: (tool: ToolWithConnection) => void;
  onManage?: (tool: ToolWithConnection) => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({
  tool,
  isLoading = false,
  onConnect,
  onDisconnect,
  onManage,
  attempt,
}) => {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  // Match the backend toolkit ID to the shared brand registry.
  const provider = getProvider(tool.toolkit_slug, tool.slug, tool.id, tool.name);
  const name = provider?.name || (tool.toolkit_slug==='google_maps'||tool.id==='google_maps'?'Google Maps':tool.name || tool.toolkit_slug || tool.slug);
  const isConnected = tool.status === 'connected';
  const isPending = tool.status === 'pending';
  const isFailed = tool.status === 'failed';

  // Subtitle resolution
  let subtitle = tool.description || null;
  if (isConnected) {
    subtitle = tool.connected_email || tool.connected_label || 'Connected';
  } else if (isPending) {
    subtitle = 'Authorization pending...';
  } else if (isFailed) {
    subtitle = 'Connection failed. Tap retry.';
  } else if (tool.enabled === false) {
    subtitle = tool.availability_reason || 'OAuth setup required';
  } else if (tool.status === 'revoked') {
    subtitle = tool.availability_reason || 'Authorization expired. Reconnect.';
  }

  return (
    <View style={styles.listRow}>
      {/* 1. Tool Logo Image from DB */}
      <View style={styles.logoWrapper}>
        <ProviderLogo identifiers={[tool.toolkit_slug, tool.slug, tool.id]} name={name} uri={tool.icon_url || tool.logo_url} />
      </View>

      {/* 2. Tool Name & Subtitle / Status */}
      <View style={styles.infoWrapper}>
        <View style={styles.nameRow}>
          <Text style={styles.toolName} numberOfLines={1}>
            {name}
          </Text>
          {isConnected && <View style={styles.connectedDot} />}
          {isPending && <View style={styles.pendingDot} />}
        </View>

        {subtitle && (
          <Text
            style={[
              styles.subtitleText,
              isConnected && styles.connectedSubtitleText,
              isFailed && styles.failedSubtitleText,
              isPending && styles.pendingSubtitleText,
            ]}
            numberOfLines={tool.enabled === false ? 3 : 1}>
            {subtitle}
          </Text>
        )}
        {attempt?.error ? <Text accessibilityRole="alert" style={[styles.attemptText, { color: Colors.error }]}>{attempt.error}</Text> : null}
        {attempt?.url ? <><Text selectable numberOfLines={2} style={[styles.attemptText, { color: Colors.textLink }]}>{attempt.url}</Text><Text style={[styles.attemptText, { color: Colors.textMuted }]}>New authorization link · Expires {attempt.expiresAt ? new Date(attempt.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'soon'}. Return here after consent.</Text></> : null}
      </View>

      {/* 3. Action Buttons Section */}
      <View style={styles.actionContainer}>
        {isLoading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : isConnected ? (
          <View style={styles.connectedActions}>
            {/* Manage Option */}
            {onManage && (
              <TouchableOpacity accessibilityRole="button"
                accessibilityLabel={`Manage ${name}`} style={styles.manageButton}
                onPress={() => onManage(tool)}
                activeOpacity={0.7}>
                <HugeiconsIcon
                  icon={Settings02Icon}
                  size={16}
                  color={Colors.iconDark}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            )}

            {/* Disconnect Option */}
            <TouchableOpacity accessibilityRole="button"
              accessibilityLabel={`Disconnect ${name}`} style={styles.disconnectButton}
              onPress={() => onDisconnect?.(tool)}
              activeOpacity={0.7}>
              <Text style={styles.disconnectButtonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : isPending ? (
          <TouchableOpacity accessibilityRole="button"
            accessibilityLabel={`Connect ${name} again`} style={styles.pendingButton}
            onPress={() => onConnect?.(tool)}
            activeOpacity={0.7}>
            <ActivityIndicator
              size="small"
              color={Colors.warning}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.pendingButtonText}>Connect again</Text>
          </TouchableOpacity>
        ) : isFailed ? (
          <TouchableOpacity accessibilityRole="button"
            accessibilityLabel={`Retry ${name} connection`} style={styles.retryButton}
            onPress={() => onConnect?.(tool)}
            activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity accessibilityRole="button"
            accessibilityLabel={`Connect ${name}`} style={styles.connectButton}
            disabled={tool.enabled === false}
            onPress={() => onConnect?.(tool)}
            activeOpacity={0.7}>
            <Text style={styles.connectButtonText}>{tool.enabled === false ? tool.availability === 'temporarily_failing' ? 'Retry later' : 'Setup needed' : tool.status === 'revoked' ? 'Reconnect' : 'Connect'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  attemptText: { fontSize: 11, lineHeight: 16, marginTop: 5 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
  },
  logoWrapper: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  infoWrapper: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolName: {
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginLeft: 6,
  },
  pendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.warning,
    marginLeft: 6,
  },
  subtitleText: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  connectedSubtitleText: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  pendingSubtitleText: {
    color: Colors.warning,
    fontWeight: '500',
  },
  failedSubtitleText: {
    color: Colors.error,
    fontWeight: '500',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  connectedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageButton: {
    width: 44,
    height: 44,
    borderRadius: 9,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectButton: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
  },
  connectButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  pendingButton: {
    minHeight: 44,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  pendingButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.warning,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textLink,
  },
  disconnectButton: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  disconnectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.error,
  },
});
