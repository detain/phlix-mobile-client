/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/syncplay/SyncPlayModal.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import CloseGlyph from '../ui/CloseGlyph'; // MW-103
import { syncPlayManager, SyncPlayRoom } from '../../api/SyncPlayManager';
import { useSyncplayStore } from '../../store/syncplayStore';
import { syncPlayService } from '../../syncplay/SyncPlayService';
import { hashGroupPassword } from '../../syncplay/sha256';
import { describeSyncPlayRestError } from '../../syncplay/syncplayErrors';
import { fireHaptic } from '../../utils/haptics';

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
  const [joinPassword, setJoinPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentGroup = useSyncplayStore((state) => state.currentGroup);
  const isHost = useSyncplayStore((state) => state.isHost);
  const timeSyncStable = useSyncplayStore((state) => state.timeSyncStable);

  // MW-023 (review mobile__exploiter #3): every load carries a monotonic
  // sequence token. Only the most-recently-STARTED request may write the
  // list, surface an error, or lower the spinner — an older response that
  // lands after a newer one is discarded instead of overwriting fresher
  // rooms (the stale-beats-fresh class the unguarded Refresh exposed).
  const roomsRequestSeq = useRef(0);

  const loadPublicRooms = useCallback(async () => {
    const seq = ++roomsRequestSeq.current;
    setIsLoadingRooms(true);
    setError(null);
    try {
      const rooms = await syncPlayManager.getPublicRooms();
      if (seq !== roomsRequestSeq.current) return;
      setPublicRooms(rooms);
    } catch (err) {
      if (seq !== roomsRequestSeq.current) return;
      // R15-10: user-facing text comes from the error-code catalog, never raw
      // err.message (axios transport prose). The raw error stays in dev logs.
      console.warn('[SyncPlayModal] load rooms failed:', err);
      setError(describeSyncPlayRestError(err));
    } finally {
      // A superseded request must not clear the spinner a newer one owns.
      if (seq === roomsRequestSeq.current) {
        setIsLoadingRooms(false);
      }
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

      // MW-026 (review mobile__exploiter #7): a 2xx create whose envelope
      // carries no group id is a contract violation — dialing the socket with
      // an empty group_id silently strands the viewer outside their own
      // party. Refuse the dial and fail loud instead.
      if (result.roomId === '') {
        setError(
          'The server created the room but returned no room id — nothing to join. Try again or check the server version.'
        );
        return;
      }

      // Open the SyncPlay socket — the transport (port + token carrier) is
      // resolved inside the service by `syncplay/wsEndpoint.ts`; the modal has
      // no business building WS URLs (audit H1: the old {apiHost}/…/ws URL
      // pointed at the HTTP port and carried no token).
      // C1 (review mobile__asphp): a gated room also needs its WS join arm
      // to carry the gate — the REST create proved the plaintext, the socket
      // frame needs the SPEC §4 digest. Pass it while the viewer still holds
      // it (process-local cache; never persisted).
      syncPlayService.connectWithRoom(
        result.roomId,
        result.sessionId,
        password !== '' ? hashGroupPassword(password) : undefined
      );

      setRoomName('');
      setPassword('');
      onClose();
    } catch (err) {
      console.warn('[SyncPlayModal] create room failed:', err);
      setError(describeSyncPlayRestError(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (roomId: string, roomPassword?: string) => {
    // MW-026: the same junk lands in the browse list — `mapRoom` degrades a
    // group row with no id to '' (it must, to keep the row honest), so the
    // join dial needs its own refuse-loud gate before any REST/socket leg.
    if (roomId === '') {
      setError('That room row carries no room id — the server response is malformed; refresh the list and try again.');
      return;
    }
    setIsJoining(true);
    setError(null);

    try {
      const result = await syncPlayManager.joinRoom(roomId, roomPassword);

      // M-MOBILE-40 (review mobile__gameux m6): a successful group join is a
      // milestone event — medium impact on the join (Android).
      fireHaptic('medium');

      // Open the socket (endpoint resolved internally — see handleCreateRoom).
      // C1: same gate-digest carrier as the create arm — the REST join proved
      // the plaintext; the WS join frame must ride the digest or a gated room
      // refuses the socket-join and the viewer never lands in their party.
      syncPlayService.connectWithRoom(
        roomId,
        result.sessionId,
        roomPassword !== undefined && roomPassword !== ''
          ? hashGroupPassword(roomPassword)
          : undefined
      );

      // Don't let the gate linger in the reopened form (the digest cache in
      // the service is the only place it needs to survive).
      setJoinPassword('');

      onClose();
    } catch (err) {
      console.warn('[SyncPlayModal] join room failed:', err);
      setError(describeSyncPlayRestError(err));
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinById = async () => {
    if (!joinRoomId.trim()) {
      setError('Room ID is required');
      return;
    }
    // M4 (review mobile__gameux): the Join tab had no password field even
    // though `handleJoinRoom` accepts one — a gated room was unjoinable from
    // the exact screen whose purpose is joining by a shared id, so private
    // watch parties silently excluded the members they were made for. The
    // field is optional (a room ID without a gate still joins); the REST
    // join demands the plaintext (documented boundary) and the WS join arm
    // carries the SPEC §4 digest (see handleJoinRoom above).
    await handleJoinRoom(joinRoomId.trim(), joinPassword || undefined);
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
        {/* M-MOBILE-81 (review mobile__gameux Minor 26): tap-outside dismiss —
            same responder law as QualityMenu/ProfileSelect/hub sign-in sheet. */}
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        >
          <View style={styles.content} onStartShouldSetResponder={() => true}>
            <View style={styles.header}>
              <Text style={styles.title}>SyncPlay</Text>
              <CloseGlyph onPress={onClose} accessibilityLabel="Close SyncPlay" />
            </View>

            <Text style={styles.groupName}>{currentGroup.name}</Text>
            <Text style={styles.groupInfo}>
              {isHost ? 'You are the host' : `Host: ${currentGroup.members.find((m) => m.id === currentGroup.hostId)?.name ?? 'Unknown'}`}
            </Text>

            {/* M-MOBILE-06 — private rooms were unjoinable because the id the
                Join-by-ID tab needs was never surfaced: after create, the
                modal closed with the id only in a discarded result object.
                The id now lives in the in-group panel as SELECTABLE text —
                press-and-hold copies it (both platforms), no new dependency
                — and the host can hand it to friends. */}
            {currentGroup.id !== '' && (
              <View style={styles.roomIdRow}>
                <Text style={styles.roomIdLabel}>Room ID</Text>
                <Text style={styles.roomIdValue} selectable numberOfLines={1}>
                  {currentGroup.id}
                </Text>
              </View>
            )}
            <Text style={styles.roomIdHint}>
              Sharing a private room? Send the Room ID above to friends — they
              enter it on the Join tab.
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
              <Text style={styles.leaveButtonText}>Leave Room</Text>
            </TouchableOpacity>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.timeSyncStatus}>
              <Text style={styles.timeSyncLabel}>Time Sync</Text>
              <Text style={styles.timeSyncValue}>
                {timeSyncStable ? 'Stable' : 'Syncing…'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
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
      {/* M-MOBILE-81 (review mobile__gameux Minor 26): tap-outside dismiss —
          same responder law as the sheet above, QualityMenu and ProfileSelect. */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.content} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>SyncPlay</Text>
            <CloseGlyph onPress={onClose} accessibilityLabel="Close SyncPlay" />
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
                      testID="syncplay-room-row"
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
                style={[styles.refreshButton, isLoadingRooms && styles.actionButtonDisabled]}
                testID="syncplay-refresh"
                onPress={loadPublicRooms}
                // MW-023: no second GET while one is in flight (the seq token
                // in loadPublicRooms still owns the write lane for every
                // other request origin, e.g. the reopen-while-pending effect).
                disabled={isLoadingRooms}
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
                placeholderTextColor="#888"
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
                    placeholderTextColor="#888"
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
                placeholderTextColor="#888"
              />

              {/* M4: gated rooms are exactly what a shared Room ID implies —
               * the password arm of the join form. */}
              <Text style={styles.inputLabel}>Password (if the room has one)</Text>
              <TextInput
                style={styles.textInput}
                value={joinPassword}
                onChangeText={setJoinPassword}
                placeholder="Enter password"
                placeholderTextColor="#888"
                secureTextEntry
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
      </TouchableOpacity>
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
  // M-MOBILE-06 — Room ID affordance in the in-group panel.
  roomIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomIdLabel: {
    color: '#888',
    fontSize: 13,
    marginRight: 8,
  },
  roomIdValue: {
    color: '#0066cc',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  roomIdHint: {
    color: '#888',
    fontSize: 12,
    marginBottom: 16,
  },
});

export default SyncPlayModal;