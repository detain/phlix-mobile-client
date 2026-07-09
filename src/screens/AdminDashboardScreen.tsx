/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/AdminDashboardScreen.tsx
import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../components/ui';
import { useAuthStore } from '../stores/useAuthStore';
import { useAdminStore } from '../stores/useAdminStore';
import type {
  NowPlayingSession,
  TopUser,
  TopMedia,
  StorageStat,
  ActivityEntry,
} from '../types/admin';
import { formatFileSize } from '../utils/formatters';

/** Human label for a now-playing session row, tolerant of missing fields. */
const sessionLabel = (s: NowPlayingSession): string =>
  s.media_title || String(s.media_item_id ?? 'Unknown title');

const sessionUser = (s: NowPlayingSession): string =>
  s.username || String(s.user_id ?? 'unknown');

const topUserLabel = (u: TopUser): string =>
  u.display_name || u.username || String(u.user_id ?? 'unknown');

const topMediaLabel = (m: TopMedia): string =>
  m.title || m.name || String(m.media_item_id ?? 'Unknown');

const storageLabel = (s: StorageStat): string =>
  s.library_name || String(s.library_id ?? 'Library');

const activityLabel = (a: ActivityEntry): string => {
  const who = a.username || a.user_id || 'Someone';
  const what = a.action || 'activity';
  const item = a.media_title ? ` · ${a.media_title}` : '';
  return `${who} — ${what}${item}`;
};

const AdminDashboardScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = !!user?.is_admin;

  const nowPlaying = useAdminStore((state) => state.nowPlaying);
  const topUsers = useAdminStore((state) => state.topUsers);
  const topMedia = useAdminStore((state) => state.topMedia);
  const storage = useAdminStore((state) => state.storage);
  const activity = useAdminStore((state) => state.activity);
  const isLoading = useAdminStore((state) => state.dashboardLoading);
  const error = useAdminStore((state) => state.dashboardError);
  const loadDashboard = useAdminStore((state) => state.loadDashboard);

  const refresh = useCallback(() => {
    if (isAdmin) {
      loadDashboard();
    }
  }, [isAdmin, loadDashboard]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasData =
    nowPlaying.length > 0 ||
    topUsers.length > 0 ||
    topMedia.length > 0 ||
    storage.length > 0 ||
    activity.length > 0;

  // Non-admin: the routes are admin-only — show an informational state.
  if (!isAdmin) {
    return (
      <SafeContainer edges={['top']}>
        <EmptyState
          icon="🔒"
          title="Admin access required"
          message="This area is only available to server administrators."
        />
      </SafeContainer>
    );
  }

  if (isLoading && !hasData) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (error && !hasData) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={error} onRetry={refresh} />
      </SafeContainer>
    );
  }

  const totalStorage = storage.reduce(
    (sum, s) => sum + (typeof s.total_size === 'number' ? s.total_size : 0),
    0
  );

  return (
    <SafeContainer edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor="#0066cc"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Server overview</Text>
        </View>

        {/* Summary tiles */}
        <View style={styles.tileRow}>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{nowPlaying.length}</Text>
            <Text style={styles.tileLabel}>Now playing</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{storage.length}</Text>
            <Text style={styles.tileLabel}>Libraries</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{formatFileSize(totalStorage)}</Text>
            <Text style={styles.tileLabel}>Storage</Text>
          </View>
        </View>

        {/* Now playing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Now Playing</Text>
          <View style={styles.card}>
            {nowPlaying.length === 0 ? (
              <Text style={styles.emptyRow}>No active sessions.</Text>
            ) : (
              nowPlaying.map((s, i) => (
                <View
                  key={s.session_id ?? `${s.media_item_id ?? 'np'}-${i}`}
                  style={styles.row}
                >
                  <Text style={styles.rowPrimary} numberOfLines={1}>
                    {sessionLabel(s)}
                  </Text>
                  <Text style={styles.rowSecondary} numberOfLines={1}>
                    {sessionUser(s)}
                    {typeof s.progress_percent === 'number'
                      ? ` · ${Math.round(s.progress_percent)}%`
                      : ''}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Top users */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Users</Text>
          <View style={styles.card}>
            {topUsers.length === 0 ? (
              <Text style={styles.emptyRow}>No data yet.</Text>
            ) : (
              topUsers.map((u, i) => (
                <View key={u.user_id ?? `tu-${i}`} style={styles.row}>
                  <Text style={styles.rowPrimary} numberOfLines={1}>
                    {topUserLabel(u)}
                  </Text>
                  {typeof u.play_count === 'number' ? (
                    <Text style={styles.rowCount}>{u.play_count}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>

        {/* Top media */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Media</Text>
          <View style={styles.card}>
            {topMedia.length === 0 ? (
              <Text style={styles.emptyRow}>No data yet.</Text>
            ) : (
              topMedia.map((m, i) => (
                <View key={m.media_item_id ?? `tm-${i}`} style={styles.row}>
                  <Text style={styles.rowPrimary} numberOfLines={1}>
                    {topMediaLabel(m)}
                  </Text>
                  {typeof m.play_count === 'number' ? (
                    <Text style={styles.rowCount}>{m.play_count}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>

        {/* Storage breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Storage</Text>
          <View style={styles.card}>
            {storage.length === 0 ? (
              <Text style={styles.emptyRow}>No libraries.</Text>
            ) : (
              storage.map((s, i) => (
                <View key={s.library_id ?? `st-${i}`} style={styles.row}>
                  <Text style={styles.rowPrimary} numberOfLines={1}>
                    {storageLabel(s)}
                  </Text>
                  <Text style={styles.rowSecondary}>
                    {typeof s.item_count === 'number'
                      ? `${s.item_count} items · `
                      : ''}
                    {formatFileSize(
                      typeof s.total_size === 'number' ? s.total_size : 0
                    )}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Recent activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.card}>
            {activity.length === 0 ? (
              <Text style={styles.emptyRow}>No recent activity.</Text>
            ) : (
              activity.map((a, i) => (
                <View key={a.id ?? `act-${i}`} style={styles.row}>
                  <Text style={styles.rowPrimary} numberOfLines={2}>
                    {activityLabel(a)}
                  </Text>
                  {a.created_at ? (
                    <Text style={styles.rowSecondary}>{a.created_at}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  tileRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginHorizontal: 4,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tileValue: {
    color: '#0066cc',
    fontSize: 20,
    fontWeight: '700',
  },
  tileLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  rowPrimary: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  rowSecondary: {
    color: '#888',
    fontSize: 13,
  },
  rowCount: {
    color: '#0066cc',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyRow: {
    color: '#666',
    fontSize: 14,
    padding: 16,
  },
});

export default AdminDashboardScreen;
