/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 */

// src/screens/admin/AdminLogsScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeContainer } from '../../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../../components/ui';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAdminStore } from '../../stores/useAdminStore';
import type { LogFile } from '../../types/admin';
import { formatBackupSize, LOG_LINE_OPTIONS, clampLogLines } from './adminScreenHelpers';

// A sentinel "file" identifying the merged tail-all view in the picker.
const ALL_LOGS = '__all__';

const AdminLogsScreen: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = !!user?.is_admin;

  const logFiles = useAdminStore((state) => state.logFiles);
  const logFilesLoading = useAdminStore((state) => state.logFilesLoading);
  const logFilesError = useAdminStore((state) => state.logFilesError);
  const loadLogFiles = useAdminStore((state) => state.loadLogFiles);
  const currentTail = useAdminStore((state) => state.currentTail);
  const tailLoading = useAdminStore((state) => state.tailLoading);
  const tailError = useAdminStore((state) => state.tailError);
  const tailLog = useAdminStore((state) => state.tailLog);
  const tailAllLogs = useAdminStore((state) => state.tailAllLogs);

  // The selected file (a real name, or ALL_LOGS) and the requested line count.
  const [selected, setSelected] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState<number>(LOG_LINE_OPTIONS[0]);

  const refresh = useCallback(() => {
    if (isAdmin) {
      loadLogFiles();
    }
  }, [isAdmin, loadLogFiles]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const doTail = useCallback(
    (file: string, lines: number) => {
      // Defence-in-depth: the chips are already in-range, but clamp to the
      // server-accepted 1–2000 window before requesting.
      const safe = clampLogLines(lines);
      if (file === ALL_LOGS) {
        tailAllLogs(safe);
      } else {
        tailLog(file, safe);
      }
    },
    [tailLog, tailAllLogs]
  );

  const openTail = (file: string) => {
    setSelected(file);
    doTail(file, lineCount);
  };

  const changeLineCount = (lines: number) => {
    setLineCount(lines);
    if (selected) {
      doTail(selected, lines);
    }
  };

  const reTail = useCallback(() => {
    if (selected) {
      doTail(selected, lineCount);
    }
  }, [selected, lineCount, doTail]);

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

  // ── Tail view (a file is selected) ──
  if (selected) {
    return (
      <SafeContainer edges={['top']}>
        <View style={styles.tailHeader}>
          <TouchableOpacity onPress={() => setSelected(null)}>
            <Text style={styles.backLink}>‹ Logs</Text>
          </TouchableOpacity>
          <Text style={styles.tailTitle} numberOfLines={1}>
            {selected === ALL_LOGS ? 'All logs (merged)' : selected}
          </Text>
        </View>

        <View style={styles.lineCountRow}>
          {LOG_LINE_OPTIONS.map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.chip, lineCount === n && styles.chipActive]}
              onPress={() => changeLineCount(n)}
            >
              <Text
                style={[
                  styles.chipText,
                  lineCount === n && styles.chipTextActive,
                ]}
              >
                {n}
              </Text>
            </TouchableOpacity>
          ))}
          {currentTail?.truncated ? (
            <Text style={styles.truncatedBadge}>truncated</Text>
          ) : null}
        </View>

        {tailLoading && !currentTail ? (
          <LoadingSpinner fullScreen />
        ) : tailError && !currentTail ? (
          <ErrorView message={tailError} onRetry={reTail} />
        ) : (
          <ScrollView
            style={styles.tailScroll}
            contentContainerStyle={styles.tailScrollContent}
            horizontal={false}
            refreshControl={
              <RefreshControl
                refreshing={tailLoading}
                onRefresh={reTail}
                tintColor="#0066cc"
              />
            }
          >
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {(currentTail?.lines ?? []).map((line, i) => (
                  <Text
                    key={`${i}-${line.slice(0, 16)}`}
                    style={styles.logLine}
                  >
                    {line}
                  </Text>
                ))}
                {(currentTail?.lines ?? []).length === 0 ? (
                  <Text style={styles.emptyLine}>(no lines)</Text>
                ) : null}
              </View>
            </ScrollView>
          </ScrollView>
        )}
      </SafeContainer>
    );
  }

  // ── File-list view ──
  if (logFilesLoading && logFiles.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (logFilesError && logFiles.length === 0) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={logFilesError} onRetry={refresh} />
      </SafeContainer>
    );
  }

  const renderFile = ({ item }: { item: LogFile }) => (
    <TouchableOpacity style={styles.fileRow} onPress={() => openTail(item.name)}>
      <View style={styles.fileIdentity}>
        <Text style={styles.fileName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.fileMeta} numberOfLines={1}>
          {formatBackupSize(item.size)} · {item.modified_at}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeContainer edges={['top']}>
      <FlatList
        data={logFiles}
        keyExtractor={(item) => item.name}
        renderItem={renderFile}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={logFilesLoading}
            onRefresh={refresh}
            tintColor="#0066cc"
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Logs</Text>
              <Text style={styles.headerSubtitle}>
                {logFiles.length} file{logFiles.length === 1 ? '' : 's'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.allLogsRow}
              onPress={() => openTail(ALL_LOGS)}
            >
              <Text style={styles.allLogsText}>All logs (merged)</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="📄"
            title="No log files"
            message="The server reported no log files."
          />
        }
      />
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexGrow: 1,
  },
  allLogsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  allLogsText: {
    color: '#0066cc',
    fontSize: 16,
    fontWeight: '600',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  fileIdentity: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fileMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  chevron: {
    color: '#888',
    fontSize: 20,
  },
  // Tail view
  tailHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backLink: {
    color: '#0066cc',
    fontSize: 15,
    marginBottom: 6,
  },
  tailTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  lineCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  chip: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#0066cc',
  },
  chipText: {
    color: '#888',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  truncatedBadge: {
    color: '#f0ad4e',
    fontSize: 12,
    marginLeft: 'auto',
    fontWeight: '600',
  },
  tailScroll: {
    flex: 1,
    backgroundColor: '#12121f',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
  },
  tailScrollContent: {
    padding: 12,
    flexGrow: 1,
  },
  logLine: {
    color: '#cfcfe0',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  emptyLine: {
    color: '#666',
    fontSize: 13,
  },
});

export default AdminLogsScreen;
