// src/components/ServerSwitcher.tsx
/**
 * ServerSwitcher Component
 *
 * A dropdown/modal component for switching between claimed servers.
 * Shows:
 * - All claimed servers from the hub
 * - Active server highlighted
 * - Online/offline status indicator
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useHubStore, ConnectionMode } from '../store/hubStore';

interface ServerSwitcherProps {
  visible: boolean;
  onClose: () => void;
}

const ServerSwitcher: React.FC<ServerSwitcherProps> = ({ visible, onClose }) => {
  const {
    servers,
    activeServerId,
    setActiveServer,
    connectionMode,
    setConnectionMode,
  } = useHubStore();

  const renderServerItem = ({
    item,
  }: {
    item: {
      serverId: string;
      serverName: string;
      status: 'online' | 'offline';
      hostname: string;
    };
  }) => {
    const isActive = item.serverId === activeServerId;

    return (
      <TouchableOpacity
        style={[styles.serverItem, isActive && styles.serverItemActive]}
        onPress={() => {
          setActiveServer(item.serverId);
          onClose();
        }}
      >
        <View style={styles.serverInfo}>
          <View
            style={[
              styles.statusIndicator,
              item.status === 'online'
                ? styles.statusOnline
                : styles.statusOffline,
            ]}
          />
          <View style={styles.serverDetails}>
            <Text
              style={[styles.serverName, isActive && styles.serverNameActive]}
            >
              {item.serverName}
            </Text>
            <Text style={styles.serverHostname}>{item.hostname}</Text>
          </View>
        </View>
        {isActive && <Text style={styles.activeLabel}>✓</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Switch Server</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Connection Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                connectionMode === 'direct' && styles.modeButtonActive,
              ]}
              onPress={() => setConnectionMode('direct')}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  connectionMode === 'direct' && styles.modeButtonTextActive,
                ]}
              >
                Direct
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                connectionMode === 'relay' && styles.modeButtonActive,
              ]}
              onPress={() => setConnectionMode('relay')}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  connectionMode === 'relay' && styles.modeButtonTextActive,
                ]}
              >
                Via Hub Relay
              </Text>
            </TouchableOpacity>
          </View>

          {/* Server List */}
          <FlatList
            data={servers}
            keyExtractor={(item) => item.serverId}
            renderItem={renderServerItem}
            style={styles.serverList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No servers found</Text>
                <Text style={styles.emptyStateSubtext}>
                  Sign in to your hub to see claimed servers
                </Text>
              </View>
            }
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    width: '90%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    color: '#888',
    fontSize: 20,
    padding: 4,
  },
  modeToggle: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2d2d44',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#0066cc',
  },
  modeButtonText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  serverList: {
    maxHeight: 300,
  },
  serverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  serverItemActive: {
    backgroundColor: 'rgba(0, 102, 204, 0.15)',
  },
  serverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusOnline: {
    backgroundColor: '#22c55e',
  },
  statusOffline: {
    backgroundColor: '#ef4444',
  },
  serverDetails: {
    flex: 1,
  },
  serverName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  serverNameActive: {
    color: '#0066cc',
  },
  serverHostname: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  activeLabel: {
    color: '#0066cc',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyStateSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ServerSwitcher;
