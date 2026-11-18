/**
 * Tools & Connections Screen ('/tools')
 *
 * Minimal list view for tool connections under Settings:
 * - Uncategorized flat list ("Show All")
 * - Displays Tool Icon, Name, and Connect/Disconnect/Manage actions
 * - Real backend Composio OAuth linking flow with polling and AppState auto-refresh
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  AppState,
  AppStateStatus,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, RefreshIcon } from '@/constants/icons';
import { useAppTheme } from '@/context/ThemeContext';
import type { ColorPalette } from '@/constants/colors';

import {
  fetchToolsWithUserConnection,
  startToolConnectionApi,
  checkToolConnectionStatusApi,
  disconnectToolApi,
} from '@/services/tools';
import { ToolWithConnection } from '@/types/tools';
import { ToolCard } from '@/components/tools/ToolCard';
import { ManageToolModal } from '@/components/tools/ManageToolModal';
import { showToast } from '@/context/ToastContext';

// Enable WebBrowser auth completion handling
WebBrowser.maybeCompleteAuthSession();

export default function ToolsConnectionsScreen() {
  const { colors: Colors } = useAppTheme();
  const styles = createStyles(Colors);
  const router = useRouter();

  const [tools, setTools] = useState<ToolWithConnection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<Record<string, { url?: string; expiresAt?: string; error?: string }>>({});
  const connectingRef = useRef(new Set<string>());

  // Track per-tool loading state during connect/disconnect/status check
  const [loadingToolIds, setLoadingToolIds] = useState<Record<string, boolean>>({});

  // Active tool for Manage modal
  const [selectedManageTool, setSelectedManageTool] = useState<ToolWithConnection | null>(null);

  // Refs for tracking active polling to prevent duplicate checks
  const checkingStatusRef = useRef<Record<string, boolean>>({});

  // 1. Load tools dataset from data layer
  const loadTools = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await fetchToolsWithUserConnection();
      setTools(data);
    } catch (err: any) {
      console.error('[tools.tsx] Error loading tools', { type: err instanceof Error ? err.name : 'Error' });
      showToast(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);
  useEffect(() => {
    const timer = setInterval(() => setAttempts(current => Object.fromEntries(Object.entries(current).map(([id, attempt]) => [id, attempt.url && !(Date.parse(attempt.expiresAt || '') > Date.now()) ? { error: 'Link expired. Tap Connect for a fresh link.' } : attempt]))), 5000);
    return () => clearInterval(timer);
  }, []);

  // 2. Refresh tools when user returns to app (AppState foreground transition)
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          console.log('[tools.tsx] App state active: refreshing tools status...');
          loadTools(true);
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [loadTools]);

  // 3. Helper to check status of a single tool via backend status endpoint
  const checkSingleToolStatus = useCallback(async (toolId: string, silent = false) => {
    if (checkingStatusRef.current[toolId]) return;
    checkingStatusRef.current[toolId] = true;

    try {
      const statusRes = await checkToolConnectionStatusApi(toolId);
      if (statusRes.status === 'connected') setAttempts(current => { const next = { ...current }; delete next[toolId]; return next; });
      else if (statusRes.statusMessage) setAttempts(current => ({ ...current, [toolId]: { ...current[toolId], error: statusRes.statusMessage || undefined } }));

      setTools((prevTools) =>
        prevTools.map((item) => {
          if (item.id === toolId) {
            const oldStatus = item.status;
            const newStatus = statusRes.status;

            if (oldStatus !== 'connected' && newStatus === 'connected' && !silent) {
              showToast(`Successfully connected to ${item.name}!`);
            } else if (newStatus === 'failed' && !silent) {
              showToast(`Connection to ${item.name} failed. Please try again.`);
            }

            return {
              ...item,
              status: newStatus,
              connected_email: statusRes.connectedEmail || item.connected_email,
              connected_label: statusRes.connectedLabel || item.connected_label,
            };
          }
          return item;
        })
      );

      // Keep selectedManageTool up to date if open
      setSelectedManageTool((prev) => {
        if (prev?.id === toolId) {
          return {
            ...prev,
            status: statusRes.status,
            connected_email: statusRes.connectedEmail || prev.connected_email,
            connected_label: statusRes.connectedLabel || prev.connected_label,
          };
        }
        return prev;
      });

      return statusRes;
    } catch (err: any) {
      console.warn('[tools.tsx] Status check failed', { toolId, type: err instanceof Error ? err.name : 'Error' });
    } finally {
      checkingStatusRef.current[toolId] = false;
    }
  }, []);

  // 4. Poll pending tools every 3.5 seconds
  useEffect(() => {
    const pendingTools = tools.filter((t) => t.status === 'pending');
    if (pendingTools.length === 0) return;

    const intervalId = setInterval(() => {
      pendingTools.forEach((tool) => {
        checkSingleToolStatus(tool.id, false);
      });
    }, 3500);

    return () => clearInterval(intervalId);
  }, [tools, checkSingleToolStatus]);

  // 5. Handle Connect action (Backend endpoint -> WebBrowser -> Status polling)
  const handleConnect = async (targetTool: ToolWithConnection) => {
    if (connectingRef.current.has(targetTool.id)) return;
    connectingRef.current.add(targetTool.id);
    setAttempts(current => ({ ...current, [targetTool.id]: {} }));
    setLoadingToolIds((prev) => ({ ...prev, [targetTool.id]: true }));

    try {
      // Expo Go cannot own the production app scheme. Its hosted completion
      // page is verified by polling, without reflecting a changing LAN origin.
      const target = Platform.OS === 'web' ? 'web' : Constants.executionEnvironment === 'storeClient' ? 'hosted' : 'native';
      const res = await startToolConnectionApi(targetTool.id, target);

      if (res.success && res.status === 'connected') { await loadTools(true); return; }
      if (!res.success || !res.connectUrl) {
        throw new Error('No authorization URL returned from server.');
      }
      if (!res.expiresAt || !(Date.parse(res.expiresAt) > Date.now())) throw new Error('The authorization link expired. Tap Connect to request another.');
      setAttempts(current => ({ ...current, [targetTool.id]: { url: res.connectUrl, expiresAt: res.expiresAt } }));

      // Step 2: Show pending state immediately
      setTools((prevTools) =>
        prevTools.map((item) =>
          item.id === targetTool.id ? { ...item, status: 'pending' } : item
        )
      );

      showToast(`Opening authentication for ${targetTool.name}...`);

      // Step 3: Open returned Composio connect URL using Expo WebBrowser
      let browserResult;
      try {
        browserResult = res.callbackUrl
          ? await WebBrowser.openAuthSessionAsync(res.connectUrl, res.callbackUrl)
          : await WebBrowser.openBrowserAsync(res.connectUrl);
      } catch (browserErr) {
        console.warn('[tools.tsx] Auth browser fallback', { type: browserErr instanceof Error ? browserErr.name : 'Error' });
        await WebBrowser.openBrowserAsync(res.connectUrl);
      }

      // Step 4: After browser closes/resolves, check status with backend
      const statusRes = await checkSingleToolStatus(targetTool.id);

      if (browserResult?.type === 'cancel' || browserResult?.type === 'dismiss') {
        if (statusRes?.status === 'pending') {
          showToast(`Authorization window closed. Connection pending...`);
        }
      }
    } catch (err: any) {
      console.error('[tools.tsx] Connect error', { toolId: targetTool.id, type: err?.name || 'Error' });
      setAttempts(current => ({ ...current, [targetTool.id]: { error: err instanceof Error ? err.message : 'Connection could not start. Tap Connect to retry.' } }));
      showToast(err.message || `Failed to connect to ${targetTool.name}`);
      // Fallback status check
      await checkSingleToolStatus(targetTool.id, true);
    } finally {
      connectingRef.current.delete(targetTool.id);
      setLoadingToolIds((prev) => ({ ...prev, [targetTool.id]: false }));
    }
  };

  // 6. Handle Disconnect action (Backend endpoint -> State update)
  const handleDisconnect = async (targetTool: ToolWithConnection) => {
    setLoadingToolIds((prev) => ({ ...prev, [targetTool.id]: true }));

    try {
      const res = await disconnectToolApi(targetTool.id);

      if (res.success) {
        setTools((prevTools) =>
          prevTools.map((item) =>
            item.id === targetTool.id
              ? {
                  ...item,
                  status: 'not_connected',
                  connected_email: null,
                  connected_label: null,
                }
              : item
          )
        );

        if (selectedManageTool?.id === targetTool.id) {
          setSelectedManageTool(null);
        }

        showToast(`Disconnected from ${targetTool.name}`);
      } else {
        throw new Error(res.message || 'Failed to disconnect tool');
      }
    } catch (err: any) {
      console.error('[tools.tsx] Disconnect error', { toolId: targetTool.id, type: err instanceof Error ? err.name : 'Error' });
      showToast(err.message || `Failed to disconnect ${targetTool.name}`);
    } finally {
      setLoadingToolIds((prev) => ({ ...prev, [targetTool.id]: false }));
    }
  };

  // 7. Handle Manage action (Opens Manage Modal)
  const handleManage = (targetTool: ToolWithConnection) => {
    setSelectedManageTool(targetTool);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button" accessibilityLabel="Back to Settings" style={styles.backButton}
            onPress={() => router.canGoBack()?router.back():router.replace('/(tabs)/settings')}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              size={22}
              color={Colors.iconDark}
              strokeWidth={2}
            />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Tools & Connections</Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button" accessibilityLabel="Refresh connections" style={styles.refreshButton}
            onPress={() => loadTools(true)}
            activeOpacity={0.7}>
            <HugeiconsIcon
              icon={RefreshIcon}
              size={20}
              color={Colors.iconDark}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Fetching tool connections...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadTools(true)}
                tintColor={Colors.primary}
              />
            }>
            {/* Flat List Container */}
            <View style={styles.listCard}>
              {tools.map((tool, index) => (
                <React.Fragment key={tool.id}>
                  {index > 0 && <View style={styles.rowDivider} />}
                  <ToolCard
                    tool={tool}
                    attempt={attempts[tool.id]}
                    isLoading={!!loadingToolIds[tool.id]}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                    onManage={handleManage}
                  />
                </React.Fragment>
              ))}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* Manage Tool Connection Modal */}
        <ManageToolModal
          visible={!!selectedManageTool}
          tool={selectedManageTool}
          isLoading={selectedManageTool ? !!loadingToolIds[selectedManageTool.id] : false}
          onClose={() => setSelectedManageTool(null)}
          onReconnect={(toolToReconnect) => {
            setSelectedManageTool(null);
            handleConnect(toolToReconnect);
          }}
          onDisconnect={(toolToDisconnect) => {
            handleDisconnect(toolToDisconnect);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.4,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 12,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 68,
  },
});
