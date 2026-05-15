<?php

declare(strict_types=1);

namespace Phlex\Session;

use Phlex\Common\Logger\LogChannels;
use Phlex\Common\Logger\LoggerFactory;
use Phlex\Common\Logger\StructuredLogger;
use Workerman\MySQL\Connection;

/**
 * Playback controller for managing playback state and progress.
 *
 * This class tracks playback progress for media items across sessions,
 * providing functionality to report progress, retrieve playback state,
 * and manage "continue watching" and "recently watched" lists.
 *
 * @author Phlex Team
 * @version 1.0.0
 * @description Manages playback state persistence and progress tracking
 *              for session-based media playback in the Phlex Media Server.
 * @see SessionManager For session lifecycle management
 *
 * @property Connection $db Database connection instance
 * @property SessionManager $sessionManager Session manager reference
 * @property StructuredLogger $logger Application logger
 */
class PlaybackController
{
    /** @var Connection Database connection for MySQL queries */
    private Connection $db;

    /** @var SessionManager Session manager for activity updates */
    private SessionManager $sessionManager;

    /** @var StructuredLogger Application logger for playback events */
    private StructuredLogger $logger;

    /**
     * Create a new PlaybackController instance.
     *
     * @param Connection $db Workerman MySQL connection instance
     * @param SessionManager $sessionManager Session manager for activity tracking
     * @param StructuredLogger|null $logger Optional application logger
     *
     * @example
     * ```php
     * $controller = new PlaybackController($db, $sessionManager);
     * ```
     */
    public function __construct(Connection $db, SessionManager $sessionManager, ?StructuredLogger $logger = null)
    {
        $this->db = $db;
        $this->sessionManager = $sessionManager;
        $this->logger = $logger ?? $this->createDefaultLogger();
    }

    /**
     * Create a default logger for playback events.
     *
     * @return StructuredLogger Configured logger instance
     */
    private function createDefaultLogger(): StructuredLogger
    {
        $tempDir = sys_get_temp_dir() . '/phlex_playback_' . uniqid();
        mkdir($tempDir, 0755, true);

        $config = [
            'handlers' => [
                'stream' => [
                    'type' => 'stream',
                    'path' => $tempDir . '/playback.log',
                    'level' => 'debug',
                ],
            ],
            'processors' => [
                'context' => true,
                'request_id' => false,
                'user_id' => false,
            ],
        ];

        return new StructuredLogger(LogChannels::SESSION, $config);
    }

    /**
     * Report playback progress for a session.
     *
     * Updates or creates playback state record for the given session
     * and media item. Also updates the parent session's activity timestamp.
     *
     * @param string $sessionId Session UUID for the playback
     * @param string $mediaItemId Media item UUID being played
     * @param int $positionTicks Current playback position in ticks
     * @param int $durationTicks Total media duration in ticks
     * @param bool $isPaused Whether playback is paused
     *
     * @return void
     *
     * @example
     * ```php
     * $controller->reportProgress(
     *     'session-uuid-123',
     *     'media-uuid-456',
     *     12000000000,  // 20 minutes in ticks
     *     36000000000,  // 1 hour in ticks
     *     false         // playing
     * );
     * ```
     */
    public function reportProgress(string $sessionId, string $mediaItemId, int $positionTicks, int $durationTicks, bool $isPaused): void
    {
        // Update or create playback state
        $this->db->query(
            "INSERT INTO playback_state (id, session_id, media_item_id, position_ticks, duration_ticks, playback_status)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                position_ticks = VALUES(position_ticks),
                duration_ticks = VALUES(duration_ticks),
                playback_status = VALUES(playback_status),
                updated_at = NOW()",
            [
                $this->generateUuid(),
                $sessionId,
                $mediaItemId,
                $positionTicks,
                $durationTicks,
                $isPaused ? 'paused' : 'playing',
            ]
        );

        // Update session activity
        $this->sessionManager->updateActivity($sessionId);
    }

    /**
     * Get current playback state for a session.
     *
     * @param string $sessionId Session UUID to get state for
     *
     * @return array<string, mixed>|null Playback state record or null if not found
     *
     * @example
     * ```php
     * $state = $controller->getPlaybackState('session-uuid-123');
     * if ($state) {
     *     echo "Playing: " . $state['media_item_id'];
     * }
     * ```
     */
    public function getPlaybackState(string $sessionId): ?array
    {
        $result = $this->db->query(
            "SELECT * FROM playback_state WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1",
            [$sessionId]
        );

        return $result[0] ?? null;
    }

    /**
     * Get playback progress for a user and media item.
     *
     * Returns the most recent playback state across all of the user's sessions.
     *
     * @param string $userId User UUID to get progress for
     * @param string $mediaItemId Media item UUID to get progress for
     *
     * @return array<string, mixed>|null Playback state record or null if not found
     *
     * @example
     * ```php
     * $progress = $controller->getUserProgress('user-uuid-123', 'media-uuid-456');
     * if ($progress) {
     *     $resumePosition = $progress['position_ticks'];
     * }
     * ```
     */
    public function getUserProgress(string $userId, string $mediaItemId): ?array
    {
        $result = $this->db->query(
            "SELECT ps.* FROM playback_state ps
             INNER JOIN sessions s ON ps.session_id = s.id
             WHERE s.user_id = ? AND ps.media_item_id = ?
             ORDER BY ps.updated_at DESC LIMIT 1",
            [$userId, $mediaItemId]
        );

        return $result[0] ?? null;
    }

    /**
     * Mark a media item as watched for a session.
     *
     * Sets playback status to 'stopped' and resets position to 0.
     *
     * @param string $sessionId Session UUID to mark watched for
     * @param string $mediaItemId Media item UUID to mark as watched
     *
     * @return void
     *
     * @example
     * ```php
     * $controller->markAsWatched('session-uuid-123', 'media-uuid-456');
     * ```
     */
    public function markAsWatched(string $sessionId, string $mediaItemId): void
    {
        $this->db->query(
            "UPDATE playback_state SET playback_status = 'stopped', position_ticks = 0 WHERE session_id = ? AND media_item_id = ?",
            [$sessionId, $mediaItemId]
        );
    }

    /**
     * Clear playback progress for a session and media item.
     *
     * @param string $sessionId Session UUID to clear progress for
     * @param string $mediaItemId Media item UUID to clear progress for
     *
     * @return void
     *
     * @example
     * ```php
     * $controller->clearProgress('session-uuid-123', 'media-uuid-456');
     * ```
     */
    public function clearProgress(string $sessionId, string $mediaItemId): void
    {
        $this->db->query(
            "DELETE FROM playback_state WHERE session_id = ? AND media_item_id = ?",
            [$sessionId, $mediaItemId]
        );
    }

    /**
     * Get items the user has in progress (continue watching).
     *
     * Returns media items that are currently being watched but not yet completed,
     * ordered by most recently watched.
     *
     * @param string $userId User UUID to get continue watching list for
     * @param int $limit Maximum number of items to return (default: 10)
     *
     * @return array<int, array<string, mixed>> Array of playback state records with media info
     *
     * @example
     * ```php
     * $continueWatching = $controller->getContinueWatching('user-uuid-123', 5);
     * foreach ($continueWatching as $item) {
     *     echo $item['name'] . " - " . $item['progress_percent'] . "% complete";
     * }
     * ```
     */
    public function getContinueWatching(string $userId, int $limit = 10): array
    {
        $result = $this->db->query(
            "SELECT ps.*, mi.name, mi.type, mi.metadata_json
             FROM playback_state ps
             INNER JOIN sessions s ON ps.session_id = s.id
             INNER JOIN media_items mi ON ps.media_item_id = mi.id
             WHERE s.user_id = ?
               AND ps.playback_status IN ('playing', 'paused')
               AND ps.position_ticks > 0
               AND ps.position_ticks < (ps.duration_ticks * 0.95)
             ORDER BY ps.updated_at DESC
             LIMIT ?",
            [$userId, $limit]
        );

        return array_map(function ($row) {
            $row['metadata'] = json_decode($row['metadata_json'] ?? '{}', true);
            return $row;
        }, $result);
    }

    /**
     * Get recently watched items for a user.
     *
     * Returns all media items in reverse chronological order by last watch time.
     *
     * @param string $userId User UUID to get recently watched for
     * @param int $limit Maximum number of items to return (default: 20)
     *
     * @return array<int, array<string, mixed>> Array of playback state records with media info
     *
     * @example
     * ```php
     * $recentlyWatched = $controller->getRecentlyWatched('user-uuid-123', 10);
     * ```
     */
    public function getRecentlyWatched(string $userId, int $limit = 20): array
    {
        $result = $this->db->query(
            "SELECT ps.*, mi.name, mi.type, mi.metadata_json
             FROM playback_state ps
             INNER JOIN sessions s ON ps.session_id = s.id
             INNER JOIN media_items mi ON ps.media_item_id = mi.id
             WHERE s.user_id = ?
             ORDER BY ps.updated_at DESC
             LIMIT ?",
            [$userId, $limit]
        );

        return array_map(function ($row) {
            $row['metadata'] = json_decode($row['metadata_json'] ?? '{}', true);
            return $row;
        }, $result);
    }

    /**
     * Generate a UUID v4 string.
     *
     * @return string UUID in standard format
     */
    private function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
