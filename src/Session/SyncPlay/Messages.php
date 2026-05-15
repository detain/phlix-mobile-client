<?php

declare(strict_types=1);

namespace Phlex\Session\SyncPlay;

/**
 * Messages - WebSocket message types for SyncPlay protocol
 *
 * Defines all message types and their validation/serialization
 * for the SyncPlay group watching protocol.
 */
final class Messages
{
    // Message type constants
    public const TYPE_GROUP_CREATE = 'syncplay_group_create';
    public const TYPE_GROUP_JOIN = 'syncplay_group_join';
    public const TYPE_GROUP_LEAVE = 'syncplay_group_leave';
    public const TYPE_GROUP_STATE = 'syncplay_group_state';
    public const TYPE_GROUP_LIST = 'syncplay_group_list';

    public const TYPE_PLAYBACK_PLAY = 'syncplay_playback_play';
    public const TYPE_PLAYBACK_PAUSE = 'syncplay_playback_pause';
    public const TYPE_PLAYBACK_SEEK = 'syncplay_playback_seek';
    public const TYPE_PLAYBACK_QUEUE = 'syncplay_playback_queue';
    public const TYPE_PLAYBACK_SYNC = 'syncplay_playback_sync';

    public const TYPE_CHAT_MESSAGE = 'syncplay_chat';
    public const TYPE_CHAT_TYPING = 'syncplay_typing';

    public const TYPE_HOST_TRANSFER = 'syncplay_host_transfer';
    public const TYPE_HOST_ELECT = 'syncplay_host_elect';

    public const TYPE_TIME_PING = 'syncplay_time_ping';
    public const TYPE_TIME_PONG = 'syncplay_time_pong';
    public const TYPE_TIME_SYNC = 'syncplay_time_sync';

    public const TYPE_ERROR = 'syncplay_error';
    public const TYPE_INFO = 'syncplay_info';

    // Protocol version
    public const PROTOCOL_VERSION = 1;

    /**
     * All valid message types
     */
    private const VALID_TYPES = [
        self::TYPE_GROUP_CREATE,
        self::TYPE_GROUP_JOIN,
        self::TYPE_GROUP_LEAVE,
        self::TYPE_GROUP_STATE,
        self::TYPE_GROUP_LIST,
        self::TYPE_PLAYBACK_PLAY,
        self::TYPE_PLAYBACK_PAUSE,
        self::TYPE_PLAYBACK_SEEK,
        self::TYPE_PLAYBACK_QUEUE,
        self::TYPE_PLAYBACK_SYNC,
        self::TYPE_CHAT_MESSAGE,
        self::TYPE_CHAT_TYPING,
        self::TYPE_HOST_TRANSFER,
        self::TYPE_HOST_ELECT,
        self::TYPE_TIME_PING,
        self::TYPE_TIME_PONG,
        self::TYPE_TIME_SYNC,
        self::TYPE_ERROR,
        self::TYPE_INFO,
    ];

    /**
     * Check if a message type is valid
     */
    public static function isValidType(string $type): bool
    {
        return in_array($type, self::VALID_TYPES, true);
    }

    /**
     * Get all valid message types
     */
    public static function getValidTypes(): array
    {
        return self::VALID_TYPES;
    }

    /**
     * Create a group creation request message
     */
    public static function groupCreate(string $groupName, ?string $password = null): array
    {
        $message = [
            'type' => self::TYPE_GROUP_CREATE,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_name' => $groupName,
            'timestamp' => self::getCurrentTimestamp(),
        ];

        if ($password !== null) {
            $message['password_hash'] = self::hashPassword($password);
        }

        return $message;
    }

    /**
     * Create a group join request message
     */
    public static function groupJoin(string $groupId, ?string $password = null): array
    {
        $message = [
            'type' => self::TYPE_GROUP_JOIN,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'timestamp' => self::getCurrentTimestamp(),
        ];

        if ($password !== null) {
            $message['password_hash'] = self::hashPassword($password);
        }

        return $message;
    }

    /**
     * Create a group leave request message
     */
    public static function groupLeave(string $groupId, string $memberId): array
    {
        return [
            'type' => self::TYPE_GROUP_LEAVE,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'member_id' => $memberId,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create a group state message (broadcast by host)
     */
    public static function groupState(
        string $groupId,
        array $members,
        ?string $currentMediaId = null,
        ?int $playbackPosition = null,
        ?string $playbackState = null,
        ?string $hostId = null
    ): array {
        $message = [
            'type' => self::TYPE_GROUP_STATE,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'members' => $members,
            'timestamp' => self::getCurrentTimestamp(),
        ];

        if ($currentMediaId !== null) {
            $message['current_media_id'] = $currentMediaId;
        }

        if ($playbackPosition !== null) {
            $message['playback_position'] = $playbackPosition;
        }

        if ($playbackState !== null) {
            $message['playback_state'] = $playbackState;
        }

        if ($hostId !== null) {
            $message['host_id'] = $hostId;
        }

        return $message;
    }

    /**
     * Create a playback play message
     */
    public static function playbackPlay(
        string $groupId,
        string $memberId,
        int $position,
        int $serverTime
    ): array {
        return [
            'type' => self::TYPE_PLAYBACK_PLAY,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'member_id' => $memberId,
            'position' => $position,
            'server_time' => $serverTime,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create a playback pause message
     */
    public static function playbackPause(
        string $groupId,
        string $memberId,
        int $position,
        int $serverTime
    ): array {
        return [
            'type' => self::TYPE_PLAYBACK_PAUSE,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'member_id' => $memberId,
            'position' => $position,
            'server_time' => $serverTime,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create a playback seek message
     */
    public static function playbackSeek(
        string $groupId,
        string $memberId,
        int $fromPosition,
        int $toPosition,
        int $serverTime
    ): array {
        return [
            'type' => self::TYPE_PLAYBACK_SEEK,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'member_id' => $memberId,
            'from_position' => $fromPosition,
            'to_position' => $toPosition,
            'server_time' => $serverTime,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create a playback queue update message
     */
    public static function playbackQueue(string $groupId, array $queue): array
    {
        return [
            'type' => self::TYPE_PLAYBACK_QUEUE,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'queue' => $queue,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create a playback sync request message (sent by host periodically)
     */
    public static function playbackSync(
        string $groupId,
        string $memberId,
        int $position,
        bool $isPlaying,
        int $serverTime
    ): array {
        return [
            'type' => self::TYPE_PLAYBACK_SYNC,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'member_id' => $memberId,
            'position' => $position,
            'is_playing' => $isPlaying,
            'server_time' => $serverTime,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create a chat message
     */
    public static function chatMessage(string $groupId, string $memberId, string $message): array
    {
        return [
            'type' => self::TYPE_CHAT_MESSAGE,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'member_id' => $memberId,
            'message' => $message,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create a typing indicator message
     */
    public static function chatTyping(string $groupId, string $memberId, bool $isTyping): array
    {
        return [
            'type' => self::TYPE_CHAT_TYPING,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'member_id' => $memberId,
            'is_typing' => $isTyping,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create a host transfer message
     */
    public static function hostTransfer(string $groupId, string $currentHostId, string $newHostId): array
    {
        return [
            'type' => self::TYPE_HOST_TRANSFER,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'current_host_id' => $currentHostId,
            'new_host_id' => $newHostId,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create a host election message
     */
    public static function hostElect(string $groupId, string $electedId, string $electedBy): array
    {
        return [
            'type' => self::TYPE_HOST_ELECT,
            'protocol_version' => self::PROTOCOL_VERSION,
            'group_id' => $groupId,
            'elected_id' => $electedId,
            'elected_by' => $electedBy,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create a time sync ping message
     */
    public static function timePing(int $clientTime): array
    {
        return [
            'type' => self::TYPE_TIME_PING,
            'protocol_version' => self::PROTOCOL_VERSION,
            'client_time' => $clientTime,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create a time sync pong message
     */
    public static function timePong(int $clientTime, int $serverTime): array
    {
        return [
            'type' => self::TYPE_TIME_PONG,
            'protocol_version' => self::PROTOCOL_VERSION,
            'client_time' => $clientTime,
            'server_time' => $serverTime,
            'timestamp' => self::getCurrentTimestamp(),
        ];
    }

    /**
     * Create an error message
     */
    public static function error(string $code, string $message, ?array $details = null): array
    {
        $error = [
            'type' => self::TYPE_ERROR,
            'protocol_version' => self::PROTOCOL_VERSION,
            'error_code' => $code,
            'message' => $message,
            'timestamp' => self::getCurrentTimestamp(),
        ];

        if ($details !== null) {
            $error['details'] = $details;
        }

        return $error;
    }

    /**
     * Create an info message
     */
    public static function info(string $message, ?array $data = null): array
    {
        $info = [
            'type' => self::TYPE_INFO,
            'protocol_version' => self::PROTOCOL_VERSION,
            'message' => $message,
            'timestamp' => self::getCurrentTimestamp(),
        ];

        if ($data !== null) {
            $info['data'] = $data;
        }

        return $info;
    }

    /**
     * Validate a message structure
     *
     * @return array{valid: bool, errors: array<string>}
     */
    public static function validate(array $message): array
    {
        $errors = [];

        if (!isset($message['type'])) {
            $errors[] = 'Missing required field: type';
            return ['valid' => false, 'errors' => $errors];
        }

        if (!self::isValidType($message['type'])) {
            $errors[] = 'Invalid message type: ' . $message['type'];
        }

        if (!isset($message['protocol_version'])) {
            $errors[] = 'Missing required field: protocol_version';
        } elseif ($message['protocol_version'] > self::PROTOCOL_VERSION) {
            $errors[] = 'Protocol version mismatch: expected ' . self::PROTOCOL_VERSION . ', got ' . $message['protocol_version'];
        }

        // Validate based on message type
        $type = $message['type'];

        if (in_array($type, [self::TYPE_GROUP_CREATE, self::TYPE_GROUP_JOIN], true)) {
            if (empty($message['group_name'] ?? $message['group_id'] ?? '')) {
                $errors[] = 'Missing group identifier';
            }
        }

        if (in_array($type, [self::TYPE_GROUP_LEAVE, self::TYPE_PLAYBACK_PLAY, self::TYPE_PLAYBACK_PAUSE, self::TYPE_PLAYBACK_SEEK], true)) {
            if (empty($message['member_id'] ?? '')) {
                $errors[] = 'Missing member_id';
            }
        }

        if (in_array($type, [self::TYPE_PLAYBACK_PLAY, self::TYPE_PLAYBACK_PAUSE, self::TYPE_PLAYBACK_SEEK], true)) {
            if (!isset($message['position'])) {
                $errors[] = 'Missing playback position';
            }
            if (!isset($message['server_time'])) {
                $errors[] = 'Missing server_time';
            }
        }

        if ($type === self::TYPE_CHAT_MESSAGE) {
            if (empty($message['message'] ?? '')) {
                $errors[] = 'Missing chat message content';
            }
        }

        return ['valid' => count($errors) === 0, 'errors' => $errors];
    }

    /**
     * Serialize a message to JSON string
     */
    public static function serialize(array $message): string
    {
        return json_encode($message, JSON_THROW_ON_ERROR);
    }

    /**
     * Deserialize a message from JSON string
     *
     * @return array{valid: bool, message?: array, error?: string}
     */
    public static function deserialize(string $json): array
    {
        try {
            $message = json_decode($json, true, 512, JSON_THROW_ON_ERROR);

            if (!is_array($message)) {
                return ['valid' => false, 'error' => 'Invalid message format'];
            }

            $validation = self::validate($message);

            if (!$validation['valid']) {
                return ['valid' => false, 'error' => implode(', ', $validation['errors'])];
            }

            return ['valid' => true, 'message' => $message];
        } catch (\JsonException $e) {
            return ['valid' => false, 'error' => 'JSON parse error: ' . $e->getMessage()];
        }
    }

    /**
     * Get current timestamp in milliseconds
     */
    private static function getCurrentTimestamp(): int
    {
        return (int)(microtime(true) * 1000);
    }

    /**
     * Hash a password for group access
     */
    private static function hashPassword(string $password): string
    {
        return hash('sha256', $password);
    }

    /**
     * Get protocol version
     */
    public static function getProtocolVersion(): int
    {
        return self::PROTOCOL_VERSION;
    }
}
