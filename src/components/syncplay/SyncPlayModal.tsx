/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/syncplay/SyncPlayModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { syncPlayManager, SyncPlayRoom } from '../../api/SyncPlayManager';
import { useSyncplayStore } from '../../store/syncplayStore';
import { syncPlayService } from '../../syncplay/SyncPlayService';

interface SyncPlayModalProps {
  visible: boolean;
  onClose: () => void;
  itemId: string;
}

type ModalTab = 'browse' | 'create' | 'join';

const SyncPlayModal: React.FC<SyncPlayModalProps> = ({ visible, onClose, itemId: _itemId }) => {
  // _itemId: Reserved for future use (e.g., auto-join based on current media)
  const [activeTab, setActiveTab] = useState<ModalTab>('browse');
  const [publicRooms, setPublicRooms] = useState<SyncPlayRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentGroup = useSyncplayStore((state) => state.currentGroup);
  const isHost = useSyncplayStore((state) => state.isHost);
  const timeSyncStable = useSyncplayStore((state) => state.timeSyncStable);

  const loadPublicRooms = useCallback(async () => {
    setIsLoadingRooms(true);
    setError(null);
    try {
      const rooms = await syncPlayManager.getPublicRooms();
      setPublicRooms(rooms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    } finally {
      setIsLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadPublicRooms();
    }
  }, [visible, loadPublicRooms]);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      setError('Room name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const result = await syncPlayManager.createRoom({
        name: roomName.trim(),
        isPublic,
        password: password || undefined,
      });

      // Connect to the WebSocket with the room
      const wsUrl = await syncPlayManager.getWebSocketUrl(result.roomId);
      syncPlayService.connectWithRoom(result.roomId, result.sessionId, wsUrl);

      setRoomName('');
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (roomId: string, roomPassword?: string) => {
    setIsJoining(true);
    setError(null);

    try {
      const result = await syncPlayManager.joinRoom(roomId, roomPassword);

      // Connect to the WebSocket with the room
      const wsUrl = await syncPlayManager.getWebSocketUrl(roomId);
      syncPlayService.connectWithRoom(roomId, result.sessionId, wsUrl);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinById = async () => {
    if (!joinRoomId.trim()) {
      setError('Room ID is required');
      return;
    }
    await handleJoinRoom(joinRoomId.trim());
  };

  const handleLeaveRoom = () => {
    syncPlayService.leaveGroup();
    onClose();
  };

  // If already in a group, show group info instead of modal
  if (currentGroup) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>SyncPlay</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.groupName}>{currentGroup.name}</Text>
            <Text style={styles.groupInfo}>
              {isHost ? 'You are the host' : `Host: ${currentGroup.members.find((m) => m.id === currentGroup.hostId)?.name ?? 'Unknown'}`}
            </Text>

            <ScrollView style={styles.memberList}>
              {currentGroup.members.map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <Text style={styles.memberName}>
                    {member.name} {member.id === currentGroup.hostId ? '👑' : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.leaveButton}
              onPress={handleLeaveRoom}
            >
              <Text style={styles.leaveButtonText}>Leave Group</Text>
            </TouchableOpacity>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.timeSyncStatus}>
              <Text style={styles.timeSyncLabel}>Time Sync</Text>
              <Text style={styles.timeSyncValue}>
                {timeSyncStable ? 'Stable' : 'Syncing...'}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>SyncPlay</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'browse' && styles.activeTab]}
              onPress={() => setActiveTab('browse')}
            >
              <Text style={[styles.tabText, activeTab === 'browse' && styles.activeTabText]}>
                Browse
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'create' && styles.activeTab]}
              onPress={() => setActiveTab('create')}
            >
              <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>
                Create
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'join' && styles.activeTab]}
              onPress={() => setActiveTab('join')}
            >
              <Text style={[styles.tabText, activeTab === 'join' && styles.activeTabText]}>
                Join
              </Text>
            </TouchableOpacity>
          </View>

          {/* Browse Tab - Public Rooms List */}
          {activeTab === 'browse' && (
            <View style={styles.tabContent}>
              {isLoadingRooms ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : publicRooms.length === 0 ? (
                <Text style={styles.emptyText}>No public rooms available</Text>
              ) : (
                <ScrollView style={styles.roomList}>
                  {publicRooms.map((room) => (
                    <TouchableOpacity
                      key={room.id}
                      style={styles.roomRow}
                      onPress={() => handleJoinRoom(room.id)}
                      disabled={isJoining}
                    >
                      <View style={styles.roomInfo}>
                        <Text style={styles.roomName}>{room.name}</Text>
                        <Text style={styles.roomMeta}>
                          {room.memberCount} member{room.memberCount !== 1 ? 's' : ''} • Host: {room.hostName}
                        </Text>
                      </View>
                      <Text style={styles.joinIcon}>▶</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={loadPublicRooms}
              >
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Create Tab */}
          {activeTab === 'create' && (
            <View style={styles.tabContent}>
              <Text style={styles.inputLabel}>Room Name</Text>
              <TextInput
                style={styles.textInput}
                value={roomName}
                onChangeText={setRoomName}
                placeholder="Enter room name"
                placeholderTextColor="#666"
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Public Room</Text>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: '#2d2d44', true: '#0066cc' }}
                  thumbColor="#fff"
                />
              </View>

              {!isPublic && (
                <>
                  <Text style={styles.inputLabel}>Password (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password"
                    placeholderTextColor="#666"
                    secureTextEntry
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.actionButton, isCreating && styles.actionButtonDisabled]}
                onPress={handleCreateRoom}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Create Room</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Join Tab */}
          {activeTab === 'join' && (
            <View style={styles.tabContent}>
              <Text style={styles.inputLabel}>Room ID</Text>
              <TextInput
                style={styles.textInput}
                value={joinRoomId}
                onChangeText={setJoinRoomId}
                placeholder="Enter room ID"
                placeholderTextColor="#666"
              />

              <TouchableOpacity
                style={[styles.actionButton, isJoining && styles.actionButtonDisabled]}
                onPress={handleJoinById}
                disabled={isJoining}
              >
                {isJoining ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Join Room</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  content: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    color: '#fff',
    fontSize: 20,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0066cc',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  tabContent: {
    minHeight: 200,
  },
  roomList: {
    maxHeight: 300,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  roomMeta: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  joinIcon: {
    color: '#0066cc',
    fontSize: 16,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 40,
  },
  refreshButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#0066cc',
    fontSize: 14,
  },
  inputLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  switchLabel: {
    color: '#fff',
    fontSize: 16,
  },
  actionButton: {
    backgroundColor: '#0066cc',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff6666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  groupNameText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
  },
  groupInfoText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
  },
  memberList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  memberName: {
    color: '#fff',
    fontSize: 16,
  },
  leaveButton: {
    backgroundColor: '#cc3333',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  timeSyncStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  timeSyncLabel: {
    color: '#888',
    fontSize: 14,
  },
  timeSyncValue: {
    color: '#fff',
    fontSize: 14,
  },
  groupName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 4,
  },
  groupInfo: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
  },
});

export default SyncPlayModal;