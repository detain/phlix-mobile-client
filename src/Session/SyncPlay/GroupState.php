<?php

declare(strict_types=1);

namespace Phlex\Session\SyncPlay;

/**
 * GroupState - Manages state for a SyncPlay group
 *
 * Tracks members, current media, playback position, host election,
 * and handles state synchronization within a group.
 */
class GroupState
{
    // Playback states
    public const STATE_PLAYING = 'playing';
    public const STATE_PAUSED = 'paused';
    public const STATE_BUFFERING = 'buffering';
    public const STATE_STOPPED = 'stopped';

    // Maximum members per group
    public const MAX_MEMBERS = 50;

    // Default playback position tolerance in milliseconds
    public const POSITION_TOLERANCE = 2000;

    private string $id;
    private string $name;
    private ?string $passwordHash = null;
    private array $members = [];
    private ?string $hostId = null;
    private ?string $currentMediaId = null;
    private int $currentMediaDuration = 0;
    private int $playbackPosition = 0;
    private string $playbackState = self::STATE_STOPPED;
    private array $playbackQueue = [];
    private array $chatMessages = [];
    private int $createdAt;
    private int $lastActivityAt;
    private int $positionTolerance;

    public function __construct(
        string $id,
        string $name,
        ?string $passwordHash = null,
        int $positionTolerance = self::POSITION_TOLERANCE
    ) {
        $this->id = $id;
        $this->name = $name;
        $this->passwordHash = $passwordHash;
        $this->positionTolerance = $positionTolerance;
        $this->createdAt = time();
        $this->lastActivityAt = time();
    }

    /**
     * Get the group ID
     */
    public function getId(): string
    {
        return $this->id;
    }

    /**
     * Get the group name
     */
    public function getName(): string
    {
        return $this->name;
    }

    /**
     * Check if group has a password
     */
    public function hasPassword(): bool
    {
        return $this->passwordHash !== null;
    }

    /**
     * Verify a password against the group's password
     */
    public function verifyPassword(string $password): bool
    {
        if ($this->passwordHash === null) {
            return true;
        }

        return hash_equals($this->passwordHash, hash('sha256', $password));
    }

    /**
     * Get all members
     */
    public function getMembers(): array
    {
        return $this->members;
    }

    /**
     * Get the number of members
     */
    public function getMemberCount(): int
    {
        return count($this->members);
    }

    /**
     * Check if a member exists
     */
    public function hasMember(string $memberId): bool
    {
        return isset($this->members[$memberId]);
    }

    /**
     * Get a specific member
     */
    public function getMember(string $memberId): ?array
    {
        return $this->members[$memberId] ?? null;
    }

    /**
     * Add a member to the group
     */
    public function addMember(string $memberId, array $memberData): bool
    {
        if (count($this->members) >= self::MAX_MEMBERS) {
            return false;
        }

        if (isset($this->members[$memberId])) {
            return false;
        }

        $this->members[$memberId] = array_merge($memberData, [
            'joined_at' => time(),
            'is_active' => true,
        ]);

        $this->lastActivityAt = time();

        return true;
    }

    /**
     * Remove a member from the group
     */
    public function removeMember(string $memberId): bool
    {
        if (!isset($this->members[$memberId])) {
            return false;
        }

        unset($this->members[$memberId]);

        // If host left, elect new host
        if ($this->hostId === $memberId) {
            $this->electNewHost();
        }

        $this->lastActivityAt = time();

        return true;
    }

    /**
     * Update a member's status
     */
    public function updateMember(string $memberId, array $updates): bool
    {
        if (!isset($this->members[$memberId])) {
            return false;
        }

        $this->members[$memberId] = array_merge($this->members[$memberId], $updates);
        $this->lastActivityAt = time();

        return true;
    }

    /**
     * Get the current host
     */
    public function getHostId(): ?string
    {
        return $this->hostId;
    }

    /**
     * Set the host
     */
    public function setHost(string $hostId): bool
    {
        if (!isset($this->members[$hostId])) {
            return false;
        }

        $this->hostId = $hostId;
        $this->members[$hostId]['is_host'] = true;

        $this->lastActivityAt = time();

        return true;
    }

    /**
     * Elect a new host when the current host leaves
     */
    public function electNewHost(): ?string
    {
        if (empty($this->members)) {
            $this->hostId = null;
            return null;
        }

        // Get the oldest member as fallback
        $oldestMember = null;
        $oldestTime = PHP_INT_MAX;

        foreach ($this->members as $id => $member) {
            $joinedAt = $member['joined_at'] ?? 0;
            if ($joinedAt < $oldestTime) {
                $oldestTime = $joinedAt;
                $oldestMember = $id;
            }
        }

        if ($this->hostId !== null && isset($this->members[$this->hostId])) {
            $this->members[$this->hostId]['is_host'] = false;
        }

        $this->hostId = $oldestMember;

        if ($oldestMember !== null) {
            $this->members[$oldestMember]['is_host'] = true;
        }

        return $this->hostId;
    }

    /**
     * Check if a member is the host
     */
    public function isHost(string $memberId): bool
    {
        return $this->hostId === $memberId;
    }

    /**
     * Get the current media ID
     */
    public function getCurrentMediaId(): ?string
    {
        return $this->currentMediaId;
    }

    /**
     * Get the current media duration
     */
    public function getCurrentMediaDuration(): int
    {
        return $this->currentMediaDuration;
    }

    /**
     * Get the playback position
     */
    public function getPlaybackPosition(): int
    {
        return $this->playbackPosition;
    }

    /**
     * Get the playback state
     */
    public function getPlaybackState(): string
    {
        return $this->playbackState;
    }

    /**
     * Check if playback is active
     */
    public function isPlaying(): bool
    {
        return $this->playbackState === self::STATE_PLAYING;
    }

    /**
     * Set the current media
     */
    public function setCurrentMedia(?string $mediaId, int $duration = 0): void
    {
        $this->currentMediaId = $mediaId;
        $this->currentMediaDuration = $duration;
        $this->playbackPosition = 0;
        $this->playbackState = self::STATE_STOPPED;
        $this->lastActivityAt = time();
    }

    /**
     * Update playback state
     */
    public function updatePlayback(string $state, int $position): void
    {
        $this->playbackState = $state;
        $this->playbackPosition = $position;
        $this->lastActivityAt = time();
    }

    /**
     * Set playback position (used for sync)
     */
    public function setPlaybackPosition(int $position): void
    {
        $this->playbackPosition = $position;
        $this->lastActivityAt = time();
    }

    /**
     * Get playback queue
     */
    public function getPlaybackQueue(): array
    {
        return $this->playbackQueue;
    }

    /**
     * Add to playback queue
     */
    public function addToQueue(string $mediaId, array $mediaInfo): void
    {
        $this->playbackQueue[] = [
            'media_id' => $mediaId,
            'media_info' => $mediaInfo,
            'added_at' => time(),
            'added_by' => $this->hostId,
        ];
        $this->lastActivityAt = time();
    }

    /**
     * Remove from playback queue
     */
    public function removeFromQueue(string $mediaId): bool
    {
        foreach ($this->playbackQueue as $index => $item) {
            if ($item['media_id'] === $mediaId) {
                array_splice($this->playbackQueue, $index, 1);
                $this->lastActivityAt = time();
                return true;
            }
        }
        return false;
    }

    /**
     * Clear playback queue
     */
    public function clearQueue(): void
    {
        $this->playbackQueue = [];
        $this->lastActivityAt = time();
    }

    /**
     * Get next item in queue
     */
    public function getNextInQueue(): ?array
    {
        return $this->playbackQueue[0] ?? null;
    }

    /**
     * Get chat messages
     */
    public function getChatMessages(int $limit = 50): array
    {
        return array_slice($this->chatMessages, -$limit);
    }

    /**
     * Add a chat message
     */
    public function addChatMessage(string $memberId, string $message): void
    {
        $this->chatMessages[] = [
            'member_id' => $memberId,
            'message' => $message,
            'timestamp' => time(),
        ];

        // Keep only last 100 messages
        if (count($this->chatMessages) > 100) {
            array_shift($this->chatMessages);
        }

        $this->lastActivityAt = time();
    }

    /**
     * Get creation timestamp
     */
    public function getCreatedAt(): int
    {
        return $this->createdAt;
    }

    /**
     * Get last activity timestamp
     */
    public function getLastActivityAt(): int
    {
        return $this->lastActivityAt;
    }

    /**
     * Get the position tolerance
     */
    public function getPositionTolerance(): int
    {
        return $this->positionTolerance;
    }

    /**
     * Check if another member's position is in sync with this group
     */
    public function isInSync(int $memberPosition): bool
    {
        if ($this->playbackState !== self::STATE_PLAYING) {
            return true;
        }

        return abs($memberPosition - $this->playbackPosition) <= $this->positionTolerance;
    }

    /**
     * Get full state for broadcasting
     */
    public function getState(): array
    {
        $membersList = [];
        foreach ($this->members as $id => $member) {
            $membersList[] = [
                'id' => $id,
                'name' => $member['name'] ?? 'Unknown',
                'is_host' => $id === $this->hostId,
                'joined_at' => $member['joined_at'] ?? time(),
            ];
        }

        return [
            'group_id' => $this->id,
            'group_name' => $this->name,
            'member_count' => $this->getMemberCount(),
            'members' => $membersList,
            'host_id' => $this->hostId,
            'current_media_id' => $this->currentMediaId,
            'current_media_duration' => $this->currentMediaDuration,
            'playback_position' => $this->playbackPosition,
            'playback_state' => $this->playbackState,
            'queue' => $this->playbackQueue,
            'created_at' => $this->createdAt,
            'last_activity_at' => $this->lastActivityAt,
        ];
    }

    /**
     * Serialize group state for persistence
     */
    public function serialize(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'password_hash' => $this->passwordHash,
            'members' => $this->members,
            'host_id' => $this->hostId,
            'current_media_id' => $this->currentMediaId,
            'current_media_duration' => $this->currentMediaDuration,
            'playback_position' => $this->playbackPosition,
            'playback_state' => $this->playbackState,
            'playback_queue' => $this->playbackQueue,
            'chat_messages' => $this->chatMessages,
            'created_at' => $this->createdAt,
            'last_activity_at' => $this->lastActivityAt,
            'position_tolerance' => $this->positionTolerance,
        ];
    }

    /**
     * Restore group state from serialized data
     */
    public static function deserialize(array $data): self
    {
        $group = new self(
            $data['id'],
            $data['name'],
            $data['password_hash'] ?? null,
            $data['position_tolerance'] ?? self::POSITION_TOLERANCE
        );

        $group->members = $data['members'] ?? [];
        $group->hostId = $data['host_id'] ?? null;
        $group->currentMediaId = $data['current_media_id'] ?? null;
        $group->currentMediaDuration = $data['current_media_duration'] ?? 0;
        $group->playbackPosition = $data['playback_position'] ?? 0;
        $group->playbackState = $data['playback_state'] ?? self::STATE_STOPPED;
        $group->playbackQueue = $data['playback_queue'] ?? [];
        $group->chatMessages = $data['chat_messages'] ?? [];
        $group->createdAt = $data['created_at'] ?? time();
        $group->lastActivityAt = $data['last_activity_at'] ?? time();

        return $group;
    }

    /**
     * Create a password hash
     */
    public static function hashPassword(string $password): string
    {
        return hash('sha256', $password);
    }
}
