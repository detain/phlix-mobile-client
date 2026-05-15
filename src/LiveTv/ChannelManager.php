<?php

namespace Phlex\LiveTv;

use Phlex\Common\Logger\LogChannels;
use Phlex\Common\Logger\LoggerFactory;
use Phlex\Common\Logger\StructuredLogger;
use Workerman\MySQL\Connection;

/**
 * Channel Manager - Handles channel CRUD operations and lineup management.
 *
 * Provides functionality for:
 * - Channel creation, retrieval, update, and deletion
 * - Channel lineup management
 * - Favorite channels
 * - Channel grouping and sorting
 */
class ChannelManager
{
    private Connection $db;
    private StructuredLogger $logger;

    /**
     * Channel type constants.
     */
    public const TYPE_TV = 'tv';
    public const TYPE_RADIO = 'radio';
    public const TYPE_DATA = 'data';

    /**
     * Channel visibility constants.
     */
    public const VISIBILITY_VISIBLE = 'visible';
    public const VISIBILITY_HIDDEN = 'hidden';
    public const VISIBILITY_DELETED = 'deleted';

    public function __construct(Connection $db, ?StructuredLogger $logger = null)
    {
        $this->db = $db;
        $this->logger = $logger ?? LoggerFactory::get(LogChannels::LIVETV);
    }

    /**
     * Create a new channel.
     *
     * @param array $data Channel data
     * @return array|null Created channel or null if failed
     */
    public function createChannel(array $data): ?array
    {
        $channelId = $this->generateUuid();

        $this->db->query(
            "INSERT INTO livetv_channels
             (channel_id, name, number, type, frequency, tuner_id, service_id,
              visual_id, description, icon_url, visibility, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
            [
                $channelId,
                $data['name'] ?? 'Unknown Channel',
                $data['number'] ?? 0,
                $data['type'] ?? self::TYPE_TV,
                $data['frequency'] ?? 0,
                $data['tuner_id'] ?? null,
                $data['service_id'] ?? null,
                $data['visual_id'] ?? null,
                $data['description'] ?? null,
                $data['icon_url'] ?? null,
                self::VISIBILITY_VISIBLE,
            ]
        );

        $this->logger->info('Channel created', ['channel_id' => $channelId, 'name' => $data['name']]);

        return $this->getChannel($channelId);
    }

    /**
     * Get a channel by ID.
     */
    public function getChannel(string $channelId): ?array
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_channels WHERE channel_id = ? AND visibility != ?",
            [$channelId, self::VISIBILITY_DELETED]
        );

        if (empty($result)) {
            return null;
        }

        return $this->mapChannel($result[0]);
    }

    /**
     * Get a channel by number.
     */
    public function getChannelByNumber(int $number): ?array
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_channels WHERE number = ? AND visibility = ?",
            [$number, self::VISIBILITY_VISIBLE]
        );

        if (empty($result)) {
            return null;
        }

        return $this->mapChannel($result[0]);
    }

    /**
     * Get all visible channels.
     *
     * @param string $sortBy Sort field (number, name, created_at)
     * @param string $sortOrder Sort order (ASC, DESC)
     * @return array List of channels
     */
    public function getAllChannels(string $sortBy = 'number', string $sortOrder = 'ASC'): array
    {
        $allowedSorts = ['number', 'name', 'created_at'];
        $sortBy = in_array($sortBy, $allowedSorts) ? $sortBy : 'number';
        $sortOrder = strtoupper($sortOrder) === 'DESC' ? 'DESC' : 'ASC';

        $result = $this->db->query(
            "SELECT * FROM livetv_channels WHERE visibility = ? ORDER BY $sortBy $sortOrder",
            [self::VISIBILITY_VISIBLE]
        );

        $channels = [];
        foreach ($result as $row) {
            $channels[] = $this->mapChannel($row);
        }

        return $channels;
    }

    /**
     * Get channels by type.
     */
    public function getChannelsByType(string $type): array
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_channels WHERE type = ? AND visibility = ? ORDER BY number ASC",
            [$type, self::VISIBILITY_VISIBLE]
        );

        $channels = [];
        foreach ($result as $row) {
            $channels[] = $this->mapChannel($row);
        }

        return $channels;
    }

    /**
     * Update a channel.
     */
    public function updateChannel(string $channelId, array $data): ?array
    {
        $channel = $this->getChannel($channelId);
        if (!$channel) {
            return null;
        }

        $updates = [];
        $values = [];

        if (isset($data['name'])) {
            $updates[] = 'name = ?';
            $values[] = $data['name'];
        }

        if (isset($data['number'])) {
            $updates[] = 'number = ?';
            $values[] = $data['number'];
        }

        if (isset($data['description'])) {
            $updates[] = 'description = ?';
            $values[] = $data['description'];
        }

        if (isset($data['icon_url'])) {
            $updates[] = 'icon_url = ?';
            $values[] = $data['icon_url'];
        }

        if (isset($data['visual_id'])) {
            $updates[] = 'visual_id = ?';
            $values[] = $data['visual_id'];
        }

        if (empty($updates)) {
            return $channel;
        }

        $updates[] = 'updated_at = NOW()';
        $values[] = $channelId;

        $this->db->query(
            "UPDATE livetv_channels SET " . implode(', ', $updates) . " WHERE channel_id = ?",
            $values
        );

        $this->logger->info('Channel updated', ['channel_id' => $channelId]);

        return $this->getChannel($channelId);
    }

    /**
     * Delete a channel (soft delete).
     */
    public function deleteChannel(string $channelId): bool
    {
        $channel = $this->getChannel($channelId);
        if (!$channel) {
            return false;
        }

        $this->db->query(
            "UPDATE livetv_channels SET visibility = ?, updated_at = NOW() WHERE channel_id = ?",
            [self::VISIBILITY_DELETED, $channelId]
        );

        $this->logger->info('Channel deleted', ['channel_id' => $channelId]);

        return true;
    }

    /**
     * Hide a channel (soft hide).
     */
    public function hideChannel(string $channelId): bool
    {
        $channel = $this->getChannel($channelId);
        if (!$channel) {
            return false;
        }

        $this->db->query(
            "UPDATE livetv_channels SET visibility = ?, updated_at = NOW() WHERE channel_id = ?",
            [self::VISIBILITY_HIDDEN, $channelId]
        );

        $this->logger->info('Channel hidden', ['channel_id' => $channelId]);

        return true;
    }

    /**
     * Restore a hidden or deleted channel.
     */
    public function restoreChannel(string $channelId): bool
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_channels WHERE channel_id = ?",
            [$channelId]
        );

        if (empty($result)) {
            return false;
        }

        $this->db->query(
            "UPDATE livetv_channels SET visibility = ?, updated_at = NOW() WHERE channel_id = ?",
            [self::VISIBILITY_VISIBLE, $channelId]
        );

        $this->logger->info('Channel restored', ['channel_id' => $channelId]);

        return true;
    }

    /**
     * Add a channel to favorites.
     */
    public function addToFavorites(string $channelId, string $userId): bool
    {
        $channel = $this->getChannel($channelId);
        if (!$channel) {
            return false;
        }

        $this->db->query(
            "INSERT INTO livetv_favorites (channel_id, user_id, added_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE added_at = NOW()",
            [$channelId, $userId]
        );

        $this->logger->debug('Channel added to favorites', ['channel_id' => $channelId, 'user_id' => $userId]);

        return true;
    }

    /**
     * Remove a channel from favorites.
     */
    public function removeFromFavorites(string $channelId, string $userId): bool
    {
        $this->db->query(
            "DELETE FROM livetv_favorites WHERE channel_id = ? AND user_id = ?",
            [$channelId, $userId]
        );

        $this->logger->debug('Channel removed from favorites', ['channel_id' => $channelId, 'user_id' => $userId]);

        return true;
    }

    /**
     * Get user's favorite channels.
     */
    public function getFavoriteChannels(string $userId): array
    {
        $result = $this->db->query(
            "SELECT c.* FROM livetv_channels c
             INNER JOIN livetv_favorites f ON c.channel_id = f.channel_id
             WHERE f.user_id = ? AND c.visibility = ?
             ORDER BY c.number ASC",
            [$userId, self::VISIBILITY_VISIBLE]
        );

        $channels = [];
        foreach ($result as $row) {
            $channels[] = $this->mapChannel($row);
        }

        return $channels;
    }

    /**
     * Check if a channel is in user's favorites.
     */
    public function isFavorite(string $channelId, string $userId): bool
    {
        $result = $this->db->query(
            "SELECT 1 FROM livetv_favorites WHERE channel_id = ? AND user_id = ?",
            [$channelId, $userId]
        );

        return !empty($result);
    }

    /**
     * Create a channel lineup.
     *
     * @param string $name Lineup name
     * @param string $userId Owner user ID
     * @param array $channelIds Channel IDs to include
     * @return array|null Created lineup
     */
    public function createLineup(string $name, string $userId, array $channelIds = []): ?array
    {
        $lineupId = $this->generateUuid();

        $this->db->query(
            "INSERT INTO livetv_lineups (lineup_id, name, user_id, created_at, updated_at)
             VALUES (?, ?, ?, NOW(), NOW())",
            [$lineupId, $name, $userId]
        );

        // Add channels to lineup
        $position = 0;
        foreach ($channelIds as $channelId) {
            $this->addChannelToLineup($lineupId, $channelId, $position++);
        }

        $this->logger->info('Lineup created', ['lineup_id' => $lineupId, 'name' => $name]);

        return $this->getLineup($lineupId);
    }

    /**
     * Get a lineup by ID.
     */
    public function getLineup(string $lineupId): ?array
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_lineups WHERE lineup_id = ?",
            [$lineupId]
        );

        if (empty($result)) {
            return null;
        }

        $lineup = $result[0];
        $lineup['channels'] = $this->getLineupChannels($lineupId);

        return $lineup;
    }

    /**
     * Get user's lineups.
     */
    public function getUserLineups(string $userId): array
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_lineups WHERE user_id = ? ORDER BY created_at DESC",
            [$userId]
        );

        return $result;
    }

    /**
     * Add a channel to a lineup.
     */
    public function addChannelToLineup(string $lineupId, string $channelId, int $position = 0): bool
    {
        $this->db->query(
            "INSERT INTO livetv_lineup_channels (lineup_id, channel_id, position)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE position = VALUES(position)",
            [$lineupId, $channelId, $position]
        );

        return true;
    }

    /**
     * Remove a channel from a lineup.
     */
    public function removeChannelFromLineup(string $lineupId, string $channelId): bool
    {
        $this->db->query(
            "DELETE FROM livetv_lineup_channels WHERE lineup_id = ? AND channel_id = ?",
            [$lineupId, $channelId]
        );

        return true;
    }

    /**
     * Get channels in a lineup.
     */
    public function getLineupChannels(string $lineupId): array
    {
        $result = $this->db->query(
            "SELECT c.*, lc.position FROM livetv_channels c
             INNER JOIN livetv_lineup_channels lc ON c.channel_id = lc.channel_id
             WHERE lc.lineup_id = ? AND c.visibility = ?
             ORDER BY lc.position ASC",
            [$lineupId, self::VISIBILITY_VISIBLE]
        );

        $channels = [];
        foreach ($result as $row) {
            $channels[] = $this->mapChannel($row);
        }

        return $channels;
    }

    /**
     * Delete a lineup.
     */
    public function deleteLineup(string $lineupId): bool
    {
        $this->db->query("DELETE FROM livetv_lineup_channels WHERE lineup_id = ?", [$lineupId]);
        $this->db->query("DELETE FROM livetv_lineups WHERE lineup_id = ?", [$lineupId]);

        $this->logger->info('Lineup deleted', ['lineup_id' => $lineupId]);

        return true;
    }

    /**
     * Get channel count.
     */
    public function getChannelCount(): int
    {
        $result = $this->db->query(
            "SELECT COUNT(*) as cnt FROM livetv_channels WHERE visibility = ?",
            [self::VISIBILITY_VISIBLE]
        );

        return (int) ($result[0]['cnt'] ?? 0);
    }

    /**
     * Map a database row to a channel array.
     */
    private function mapChannel(array $row): array
    {
        return [
            'id' => $row['channel_id'],
            'channel_id' => $row['channel_id'],
            'name' => $row['name'],
            'number' => (int) $row['number'],
            'type' => $row['type'],
            'frequency' => (int) $row['frequency'],
            'tuner_id' => $row['tuner_id'],
            'service_id' => $row['service_id'],
            'visual_id' => $row['visual_id'],
            'description' => $row['description'],
            'icon_url' => $row['icon_url'],
            'visibility' => $row['visibility'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    /**
     * Generate a unique ID.
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
