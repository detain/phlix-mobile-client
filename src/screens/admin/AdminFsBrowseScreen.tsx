/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/admin/AdminFsBrowseScreen.tsx
import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { SafeContainer } from '../../components/layout';
import { LoadingSpinner, ErrorView, EmptyState } from '../../components/ui';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAdminStore } from '../../stores/useAdminStore';
import type { FsEntry } from '../../types/admin';
import type { RootStackParamList } from '../../types/navigation';
import { breadcrumbs } from './adminScreenHelpers';

/**
 * A directory browser that doubles as a path picker. In `mode:'pick'` it offers
 * a "Select this folder" action which sets `fsPickedPath` on useAdminStore (a
 * serializable hand-off) and pops back — AdminLibraries reads + clears it to
 * append to its paths input. In `mode:'browse'` (default) it is read-only.
 */
const AdminFsBrowseScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AdminFsBrowse'>>();
  const mode = route.params?.mode ?? 'browse';
  const pickMode = mode === 'pick';

  const user = useAuthStore((state) => state.user);
  const isAdmin = !!user?.is_admin;

  const listing = useAdminStore((state) => state.fsListing);
  const loading = useAdminStore((state) => state.fsLoading);
  const error = useAdminStore((state) => state.fsError);
  const browseFs = useAdminStore((state) => state.browseFs);
  const setFsPickedPath = useAdminStore((state) => state.setFsPickedPath);

  const goTo = useCallback(
    (path?: string) => {
      if (isAdmin) {
        browseFs(path);
      }
    },
    [isAdmin, browseFs]
  );

  // Load the roots on mount.
  useEffect(() => {
    goTo(undefined);
  }, [goTo]);

  const handleSelectFolder = () => {
    // Only a real directory (non-root) is selectable.
    if (listing?.path) {
      setFsPickedPath(listing.path);
      navigation.goBack();
    }
  };

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

  if (loading && !listing) {
    return (
      <SafeContainer edges={['top']}>
        <LoadingSpinner fullScreen />
      </SafeContainer>
    );
  }

  if (error && !listing) {
    return (
      <SafeContainer edges={['top']}>
        <ErrorView message={error} onRetry={() => goTo(undefined)} />
      </SafeContainer>
    );
  }

  const crumbs = breadcrumbs(listing?.path ?? null);

  const renderEntry = ({ item }: { item: FsEntry }) => (
    <TouchableOpacity style={styles.entryRow} onPress={() => goTo(item.path)}>
      <Text style={styles.entryIcon}>📁</Text>
      <Text style={styles.entryName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeContainer edges={['top']}>
      {/* Breadcrumb / parent-up bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.crumbBar}
        contentContainerStyle={styles.crumbContent}
      >
        {crumbs.map((crumb, i) => (
          <View key={crumb.path} style={styles.crumbItem}>
            {i > 0 ? <Text style={styles.crumbSep}>/</Text> : null}
            <TouchableOpacity onPress={() => goTo(crumb.path)}>
              <Text style={styles.crumbText}>{crumb.label}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {listing?.parent != null ? (
        <TouchableOpacity
          style={styles.parentRow}
          onPress={() => goTo(listing.parent ?? undefined)}
        >
          <Text style={styles.parentText}>‹ Up one level</Text>
        </TouchableOpacity>
      ) : null}

      <FlatList
        data={listing?.entries ?? []}
        keyExtractor={(item) => item.path}
        renderItem={renderEntry}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="📂"
            title="No sub-folders"
            message="This directory has no sub-folders."
          />
        }
      />

      {pickMode ? (
        <TouchableOpacity
          style={[
            styles.selectButton,
            !listing?.path && styles.selectButtonDisabled,
          ]}
          onPress={handleSelectFolder}
          disabled={!listing?.path}
        >
          <Text style={styles.selectButtonText}>
            {listing?.path
              ? `Select "${listing.path}"`
              : 'Open a folder to select it'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  crumbBar: {
    maxHeight: 44,
    backgroundColor: '#1a1a2e',
  },
  crumbContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  crumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  crumbSep: {
    color: '#666',
    fontSize: 14,
    marginHorizontal: 6,
  },
  crumbText: {
    color: '#0066cc',
    fontSize: 14,
    paddingVertical: 10,
  },
  parentRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  parentText: {
    color: '#0066cc',
    fontSize: 15,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexGrow: 1,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  entryIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  entryName: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
  },
  chevron: {
    color: '#888',
    fontSize: 20,
  },
  selectButton: {
    backgroundColor: '#0066cc',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectButtonDisabled: {
    backgroundColor: '#2d2d44',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AdminFsBrowseScreen;
