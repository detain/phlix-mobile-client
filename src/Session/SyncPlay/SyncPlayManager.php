<?php

declare(strict_types=1);

namespace Phlex\Session\SyncPlay;

use Phlex\Common\Logger\LogChannels;
use Phlex\Common\Logger\StructuredLogger;
use Phlex\Server\WebSocket\Connection;
use Phlex\Server\WebSocket\ConnectionPool;
use Phlex\Server\WebSocket\MessageHandler;

/**
 * SyncPlayManager - Main manager for SyncPlay group watching functionality
 *
 * Handles group management (create, join, leave), playback synchronization,
 * host-controlled playback queue, and WebSocket integration for real-time
 * communication.
 */
class SyncPlayManager
{
    // Default position tolerance in milliseconds
    private const DEFAULT_POSITION_TOLERANCE = 2000;

    // Maximum groups allowed
    private const MAX_GROUPS = 100;

    // Group inactivity timeout (seconds)
    private const GROUP_TIMEOUT = 3600;

    // Sync interval for host broadcasts (milliseconds)
    private const SYNC_INTERVAL = 1000;

    private array $groups = [];
    private array $memberToGroup = [];
    private array $connectionToMember = [];
    private TimeSync $timeSync;
    private ?MessageHandler $messageHandler = null;
    private ?StructuredLogger $logger;
    private int $positionTolerance;
    private int $lastSyncTime = 0;

    public function __construct(
        ?StructuredLogger $logger = null,
        int $positionTolerance = self::DEFAULT_POSITION_TOLERANCE
    ) {
        $this->logger = $logger;
        $this->positionTolerance = $positionTolerance;
        $this->timeSync = new TimeSync();
    }

    /**
     * Initialize with a message handler for broadcasting
     */
    public function initialize(MessageHandler $messageHandler): void
    {
        $this->messageHandler = $messageHandler;
        $this->registerMessageHandlers();
    }

    /**
     * Register WebSocket message handlers
     */
    private function registerMessageHandlers(): void
    {
        if ($this->messageHandler === null) {
            return;
        }

        $handler = function (Connection $connection, array $payload) {
            $this->handleMessage($connection, $payload);
        };

        $this->messageHandler->on(Messages::TYPE_GROUP_CREATE, $handler);
        $this->messageHandler->on(Messages::TYPE_GROUP_JOIN, $handler);
        $this->messageHandler->on(Messages::TYPE_GROUP_LEAVE, $handler);
        $this->messageHandler->on(Messages::TYPE_PLAYBACK_PLAY, $handler);
        $this->messageHandler->on(Messages::TYPE_PLAYBACK_PAUSE, $handler);
        $this->messageHandler->on(Messages::TYPE_PLAYBACK_SEEK, $handler);
        $this->messageHandler->on(Messages::TYPE_PLAYBACK_QUEUE, $handler);
        $this->messageHandler->on(Messages::TYPE_CHAT_MESSAGE, $handler);
        $this->messageHandler->on(Messages::TYPE_CHAT_TYPING, $handler);
        $this->messageHandler->on(Messages::TYPE_TIME_PING, $handler);
    }

    /**
     * Handle incoming WebSocket message
     */
    private function handleMessage(Connection $connection, array $payload): void
    {
        $type = $payload['type'] ?? '';

        try {
            switch ($type) {
                case Messages::TYPE_GROUP_CREATE:
                    $this->handleGroupCreate($connection, $payload);
                    break;

                case Messages::TYPE_GROUP_JOIN:
                    $this->handleGroupJoin($connection, $payload);
                    break;

                case Messages::TYPE_GROUP_LEAVE:
                    $this->handleGroupLeave($connection, $payload);
                    break;

                case Messages::TYPE_PLAYBACK_PLAY:
                    $this->handlePlaybackPlay($connection, $payload);
                    break;

                case Messages::TYPE_PLAYBACK_PAUSE:
                    $this->handlePlaybackPause($connection, $payload);
                    break;

                case Messages::TYPE_PLAYBACK_SEEK:
                    $this->handlePlaybackSeek($connection, $payload);
                    break;

                case Messages::TYPE_PLAYBACK_QUEUE:
                    $this->handlePlaybackQueue($connection, $payload);
                    break;

                case Messages::TYPE_CHAT_MESSAGE:
                    $this->handleChatMessage($connection, $payload);
                    break;

                case Messages::TYPE_TIME_PING:
                    $this->handleTimePing($connection, $payload);
                    break;

                default:
                    $this->sendError($connection, 'UNKNOWN_MESSAGE', 'Unknown message type');
            }
        } catch (\Throwable $e) {
            $this->sendError($connection, 'HANDLER_ERROR', $e->getMessage());
            $this->log('error', 'Message handler error', [
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Create a new group
     */
    public function createGroup(string $name, ?string $password = null, ?string $memberId = null, ?string $memberName = null): array
    {
        if (count($this->groups) >= self::MAX_GROUPS) {
            return ['success' => false, 'error' => 'Maximum group limit reached'];
        }

        $groupId = $this->generateGroupId();
        $passwordHash = $password !== null ? GroupState::hashPassword($password) : null;

        $group = new GroupState(
            $groupId,
            $name,
            $passwordHash,
            $this->positionTolerance
        );

        // Add creator as first member and host
        if ($memberId !== null) {
            $group->addMember($memberId, [
                'name' => $memberName ?? 'Host',
                'connection_id' => null,
            ]);
            $group->setHost($memberId);
            $this->memberToGroup[$memberId] = $groupId;
        }

        $this->groups[$groupId] = $group;

        $this->log('info', 'Group created', [
            'group_id' => $groupId,
            'name' => $name,
        ]);

        return [
            'success' => true,
            'group' => $group->getState(),
        ];
    }

    /**
     * Join an existing group
     */
    public function joinGroup(string $groupId, string $memberId, string $memberName, ?string $password = null): array
    {
        $group = $this->groups[$groupId] ?? null;

        if ($group === null) {
            return ['success' => false, 'error' => 'Group not found'];
        }

        if ($group->hasPassword() && !$group->verifyPassword($password ?? '')) {
            return ['success' => false, 'error' => 'Invalid password'];
        }

        if ($group->getMemberCount() >= GroupState::MAX_MEMBERS) {
            return ['success' => false, 'error' => 'Group is full'];
        }

        if ($group->hasMember($memberId)) {
            return ['success' => false, 'error' => 'Already a member of this group'];
        }

        $memberData = [
            'name' => $memberName,
            'connection_id' => null,
        ];

        if (!$group->addMember($memberId, $memberData)) {
            return ['success' => false, 'error' => 'Failed to join group'];
        }

        $this->memberToGroup[$memberId] = $groupId;

        $this->log('info', 'Member joined group', [
            'group_id' => $groupId,
            'member_id' => $memberId,
        ]);

        // Broadcast join to group
        $this->broadcastToGroup($groupId, Messages::TYPE_INFO, [
            'message' => "{$memberName} joined the group",
            'member_id' => $memberId,
            'member_name' => $memberName,
        ], [$memberId]);

        return [
            'success' => true,
            'group' => $group->getState(),
        ];
    }

    /**
     * Leave a group
     */
    public function leaveGroup(string $memberId): array
    {
        $groupId = $this->memberToGroup[$memberId] ?? null;

        if ($groupId === null) {
            return ['success' => false, 'error' => 'Not in any group'];
        }

        $group = $this->groups[$groupId] ?? null;

        if ($group === null) {
            unset($this->memberToGroup[$memberId]);
            return ['success' => true];
        }

        $memberName = $group->getMember($memberId)['name'] ?? 'Unknown';
        $wasHost = $group->isHost($memberId);

        $group->removeMember($memberId);
        unset($this->memberToGroup[$memberId]);

        // Clean up empty groups
        if ($group->getMemberCount() === 0) {
            unset($this->groups[$groupId]);
            $this->log('info', 'Group removed (empty)', ['group_id' => $groupId]);
        } elseif ($wasHost) {
            // Broadcast host change
            $newHostId = $group->getHostId();
            $this->broadcastToGroup($groupId, Messages::TYPE_HOST_ELECT, [
                'elected_id' => $newHostId,
                'elected_by' => $memberId,
            ]);
        }

        $this->log('info', 'Member left group', [
            'group_id' => $groupId,
            'member_id' => $memberId,
        ]);

        return [
            'success' => true,
            'message' => "{$memberName} left the group",
        ];
    }

    /**
     * Get a group's state
     */
    public function getGroupState(string $groupId): ?array
    {
        $group = $this->groups[$groupId] ?? null;
        return $group?->getState();
    }

    /**
     * Get all groups (for listing)
     */
    public function listGroups(): array
    {
        $list = [];

        foreach ($this->groups as $id => $group) {
            $list[] = [
                'id' => $id,
                'name' => $group->getName(),
                'member_count' => $group->getMemberCount(),
                'has_password' => $group->hasPassword(),
                'current_media' => $group->getCurrentMediaId(),
                'is_playing' => $group->isPlaying(),
            ];
        }

        return $list;
    }

    /**
     * Handle playback play from a member
     */
    private function handlePlaybackPlay(Connection $connection, array $payload): void
    {
        $memberId = $payload['member_id'] ?? null;
        $groupId = $this->memberToGroup[$memberId] ?? null;
        $group = $this->groups[$groupId] ?? null;

        if ($group === null) {
            $this->sendError($connection, 'NOT_IN_GROUP', 'You are not in a group');
            return;
        }

        if (!$group->isHost($memberId)) {
            $this->sendError($connection, 'NOT_HOST', 'Only the host can control playback');
            return;
        }

        $position = $payload['position'] ?? 0;
        $serverTime = $payload['server_time'] ?? time();

        $group->updatePlayback(GroupState::STATE_PLAYING, $position);

        $this->broadcastToGroup($groupId, Messages::TYPE_PLAYBACK_PLAY, [
            'member_id' => $memberId,
            'position' => $position,
            'server_time' => $serverTime,
        ], [$memberId]);
    }

    /**
     * Handle playback pause from a member
     */
    private function handlePlaybackPause(Connection $connection, array $payload): void
    {
        $memberId = $payload['member_id'] ?? null;
        $groupId = $this->memberToGroup[$memberId] ?? null;
        $group = $this->groups[$groupId] ?? null;

        if ($group === null) {
            $this->sendError($connection, 'NOT_IN_GROUP', 'You are not in a group');
            return;
        }

        if (!$group->isHost($memberId)) {
            $this->sendError($connection, 'NOT_HOST', 'Only the host can control playback');
            return;
        }

        $position = $payload['position'] ?? 0;
        $serverTime = $payload['server_time'] ?? time();

        $group->updatePlayback(GroupState::STATE_PAUSED, $position);

        $this->broadcastToGroup($groupId, Messages::TYPE_PLAYBACK_PAUSE, [
            'member_id' => $memberId,
            'position' => $position,
            'server_time' => $serverTime,
        ], [$memberId]);
    }

    /**
     * Handle playback seek from a member
     */
    private function handlePlaybackSeek(Connection $connection, array $payload): void
    {
        $memberId = $payload['member_id'] ?? null;
        $groupId = $this->memberToGroup[$memberId] ?? null;
        $group = $this->groups[$groupId] ?? null;

        if ($group === null) {
            $this->sendError($connection, 'NOT_IN_GROUP', 'You are not in a group');
            return;
        }

        if (!$group->isHost($memberId)) {
            $this->sendError($connection, 'NOT_HOST', 'Only the host can control playback');
            return;
        }

        $fromPosition = $payload['from_position'] ?? 0;
        $toPosition = $payload['to_position'] ?? 0;
        $serverTime = $payload['server_time'] ?? time();

        $group->setPlaybackPosition($toPosition);

        $this->broadcastToGroup($groupId, Messages::TYPE_PLAYBACK_SEEK, [
            'member_id' => $memberId,
            'from_position' => $fromPosition,
            'to_position' => $toPosition,
            'server_time' => $serverTime,
        ], [$memberId]);
    }

    /**
     * Handle playback queue update from host
     */
    private function handlePlaybackQueue(Connection $connection, array $payload): void
    {
        $memberId = $payload['member_id'] ?? null;
        $groupId = $this->memberToGroup[$memberId] ?? null;
        $group = $this->groups[$groupId] ?? null;

        if ($group === null) {
            $this->sendError($connection, 'NOT_IN_GROUP', 'You are not in a group');
            return;
        }

        if (!$group->isHost($memberId)) {
            $this->sendError($connection, 'NOT_HOST', 'Only the host can modify the queue');
            return;
        }

        $queue = $payload['queue'] ?? [];

        // Update queue
        $group->clearQueue();
        foreach ($queue as $item) {
            $group->addToQueue($item['media_id'], $item['media_info'] ?? []);
        }

        $this->broadcastToGroup($groupId, Messages::TYPE_PLAYBACK_QUEUE, [
            'queue' => $group->getPlaybackQueue(),
        ]);
    }

    /**
     * Handle chat message
     */
    private function handleChatMessage(Connection $connection, array $payload): void
    {
        $memberId = $payload['member_id'] ?? null;
        $groupId = $this->memberToGroup[$memberId] ?? null;
        $group = $this->groups[$groupId] ?? null;

        if ($group === null) {
            $this->sendError($connection, 'NOT_IN_GROUP', 'You are not in a group');
            return;
        }

        $message = $payload['message'] ?? '';
        $memberName = $group->getMember($memberId)['name'] ?? 'Unknown';

        if (empty(trim($message))) {
            return;
        }

        $group->addChatMessage($memberId, $message);

        $this->broadcastToGroup($groupId, Messages::TYPE_CHAT_MESSAGE, [
            'member_id' => $memberId,
            'member_name' => $memberName,
            'message' => $message,
            'timestamp' => time(),
        ]);
    }

    /**
     * Handle time sync ping
     */
    private function handleTimePing(Connection $connection, array $payload): void
    {
        $pong = $this->timeSync->processPing($payload);
        $connection->sendMessage(Messages::TYPE_TIME_PONG, $pong);
    }

    /**
     * Handle group creation request
     */
    private function handleGroupCreate(Connection $connection, array $payload): void
    {
        $memberId = $payload['member_id'] ?? $connection->getId();
        $memberName = $payload['member_name'] ?? 'Host';
        $groupName = $payload['group_name'] ?? 'New Group';
        $password = $payload['password'] ?? null;

        $result = $this->createGroup($groupName, $password, $memberId, $memberName);

        if ($result['success']) {
            $connection->sendMessage(Messages::TYPE_GROUP_STATE, [
                'group' => $result['group'],
                'your_id' => $memberId,
            ]);
        } else {
            $this->sendError($connection, 'CREATE_FAILED', $result['error']);
        }
    }

    /**
     * Handle group join request
     */
    private function handleGroupJoin(Connection $connection, array $payload): void
    {
        $groupId = $payload['group_id'] ?? '';
        $memberId = $payload['member_id'] ?? $connection->getId();
        $memberName = $payload['member_name'] ?? 'User';
        $password = $payload['password'] ?? null;

        $result = $this->joinGroup($groupId, $memberId, $memberName, $password);

        if ($result['success']) {
            $connection->sendMessage(Messages::TYPE_GROUP_STATE, [
                'group' => $result['group'],
                'your_id' => $memberId,
            ]);
        } else {
            $this->sendError($connection, 'JOIN_FAILED', $result['error']);
        }
    }

    /**
     * Handle group leave request
     */
    private function handleGroupLeave(Connection $connection, array $payload): void
    {
        $memberId = $payload['member_id'] ?? null;

        $result = $this->leaveGroup($memberId);

        if ($result['success']) {
            $connection->sendMessage(Messages::TYPE_INFO, [
                'message' => $result['message'] ?? 'Left group',
            ]);
        } else {
            $this->sendError($connection, 'LEAVE_FAILED', $result['error']);
        }
    }

    /**
     * Broadcast a message to all group members
     */
    private function broadcastToGroup(string $groupId, string $type, array $data, array $excludeIds = []): void
    {
        if ($this->messageHandler === null) {
            return;
        }

        $group = $this->groups[$groupId] ?? null;
        if ($group === null) {
            return;
        }

        foreach ($group->getMembers() as $memberId => $member) {
            if (in_array($memberId, $excludeIds, true)) {
                continue;
            }

            $connectionId = $member['connection_id'] ?? null;
            if ($connectionId !== null) {
                $this->messageHandler->sendToSession($connectionId, $type, $data);
            }
        }
    }

    /**
     * Send error message to connection
     */
    private function sendError(Connection $connection, string $code, string $message): void
    {
        $connection->sendMessage(Messages::TYPE_ERROR, [
            'code' => $code,
            'message' => $message,
        ]);
    }

    /**
     * Get the time sync instance
     */
    public function getTimeSync(): TimeSync
    {
        return $this->timeSync;
    }

    /**
     * Get a member's current group ID
     */
    public function getMemberGroup(string $memberId): ?string
    {
        return $this->memberToGroup[$memberId] ?? null;
    }

    /**
     * Generate a unique group ID
     */
    private function generateGroupId(): string
    {
        return 'sp_' . bin2hex(random_bytes(8));
    }

    /**
     * Clean up stale groups
     */
    public function cleanupStaleGroups(int $timeout = self::GROUP_TIMEOUT): int
    {
        $now = time();
        $removed = 0;

        foreach ($this->groups as $id => $group) {
            if ($now - $group->getLastActivityAt() > $timeout) {
                // Notify members
                $this->broadcastToGroup($id, Messages::TYPE_INFO, [
                    'message' => 'Group timed out due to inactivity',
                ]);

                // Remove all members
                foreach ($group->getMembers() as $memberId => $member) {
                    unset($this->memberToGroup[$memberId]);
                }

                unset($this->groups[$id]);
                $removed++;
            }
        }

        return $removed;
    }

    /**
     * Get statistics
     */
    public function getStats(): array
    {
        return [
            'total_groups' => count($this->groups),
            'total_members' => count($this->memberToGroup),
            'time_sync_status' => $this->timeSync->getStatus(),
        ];
    }

    /**
     * Log a message
     */
    private function log(string $level, string $message, array $context = []): void
    {
        if ($this->logger === null) {
            return;
        }

        $this->logger->log($level, "[SyncPlay] {$message}", $context);
    }
}
