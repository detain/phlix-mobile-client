<?php

namespace Phlex\LiveTv;

use Phlex\Common\Logger\LogChannels;
use Phlex\Common\Logger\LoggerFactory;
use Phlex\Common\Logger\StructuredLogger;
use Workerman\MySQL\Connection;

/**
 * Guide Manager - Electronic Program Guide (EPG) functionality.
 *
 * Provides functionality for:
 * - Program info retrieval
 * - Guide data caching
 * - Program search
 * - EPG data import/export
 */
class GuideManager
{
    private Connection $db;
    private StructuredLogger $logger;
    private array $cache = [];
    private int $cacheTtl = 3600; // 1 hour default

    /**
     * Program category constants.
     */
    public const CATEGORY_MOVIE = 'movie';
    public const CATEGORY_SERIES = 'series';
    public const CATEGORY_NEWS = 'news';
    public const CATEGORY_SPORTS = 'sports';
    public const CATEGORY_KIDS = 'kids';
    public const CATEGORY_MUSIC = 'music';
    public const CATEGORY_EDUCATION = 'education';
    public const CATEGORY_OTHER = 'other';

    /**
     * Rating system constants.
     */
    public const RATING_SYSTEM_TV = 'tv';
    public const RATING_SYSTEM_MPAA = 'mpaa';
    public const RATING_SYSTEM_ACB = 'acb';

    public function __construct(Connection $db, ?StructuredLogger $logger = null)
    {
        $this->db = $db;
        $this->logger = $logger ?? LoggerFactory::get(LogChannels::LIVETV);
    }

    /**
     * Get current program for a channel.
     */
    public function getCurrentProgram(string $channelId): ?array
    {
        $now = time();

        $result = $this->db->query(
            "SELECT * FROM livetv_programs
             WHERE channel_id = ? AND start_time <= ? AND end_time > ?
             ORDER BY start_time DESC LIMIT 1",
            [$channelId, $now, $now]
        );

        if ($result->num_rows === 0) {
            return null;
        }

        return $this->mapProgram($result->fetch());
    }

    /**
     * Get program by ID.
     */
    public function getProgram(string $programId): ?array
    {
        // Check cache first
        $cacheKey = "program:$programId";
        if (isset($this->cache[$cacheKey])) {
            return $this->cache[$cacheKey];
        }

        $result = $this->db->query(
            "SELECT * FROM livetv_programs WHERE program_id = ?",
            [$programId]
        );

        if ($result->num_rows === 0) {
            return null;
        }

        $program = $this->mapProgram($result->fetch());
        $this->cache[$cacheKey] = $program;

        return $program;
    }

    /**
     * Get programs for a channel within a time range.
     *
     * @param string $channelId Channel ID
     * @param int $startTime Start timestamp
     * @param int $endTime End timestamp
     * @return array List of programs
     */
    public function getProgramsForChannel(string $channelId, int $startTime, int $endTime): array
    {
        $cacheKey = "channel:$channelId:$startTime:$endTime";

        // Check cache
        if (isset($this->cache[$cacheKey])) {
            return $this->cache[$cacheKey];
        }

        $result = $this->db->query(
            "SELECT * FROM livetv_programs
             WHERE channel_id = ? AND start_time < ? AND end_time > ?
             ORDER BY start_time ASC",
            [$channelId, $endTime, $startTime]
        );

        $programs = [];
        while ($row = $result->fetch()) {
            $programs[] = $this->mapProgram($row);
        }

        // Cache the result
        $this->cache[$cacheKey] = $programs;

        return $programs;
    }

    /**
     * Get programs for multiple channels.
     */
    public function getProgramsForChannels(array $channelIds, int $startTime, int $endTime): array
    {
        if (empty($channelIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($channelIds), '?'));
        $params = array_merge($channelIds, [$endTime, $startTime]);

        $result = $this->db->query(
            "SELECT * FROM livetv_programs
             WHERE channel_id IN ($placeholders) AND start_time < ? AND end_time > ?
             ORDER BY channel_id, start_time ASC",
            $params
        );

        $programsByChannel = [];
        while ($row = $result->fetch()) {
            $channelId = $row['channel_id'];
            if (!isset($programsByChannel[$channelId])) {
                $programsByChannel[$channelId] = [];
            }
            $programsByChannel[$channelId][] = $this->mapProgram($row);
        }

        return $programsByChannel;
    }

    /**
     * Search programs by title.
     */
    public function searchPrograms(string $query, int $limit = 50): array
    {
        $searchTerm = "%$query%";

        $result = $this->db->query(
            "SELECT * FROM livetv_programs
             WHERE title LIKE ? AND end_time > ?
             ORDER BY start_time ASC
             LIMIT ?",
            [$searchTerm, time(), $limit]
        );

        $programs = [];
        while ($row = $result->fetch()) {
            $programs[] = $this->mapProgram($row);
        }

        return $programs;
    }

    /**
     * Get programs by category.
     */
    public function getProgramsByCategory(string $category, int $limit = 100): array
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_programs
             WHERE category = ? AND end_time > ?
             ORDER BY start_time ASC
             LIMIT ?",
            [$category, time(), $limit]
        );

        $programs = [];
        while ($row = $result->fetch()) {
            $programs[] = $this->mapProgram($row);
        }

        return $programs;
    }

    /**
     * Get upcoming programs by series.
     */
    public function getUpcomingBySeries(string $seriesId, int $limit = 20): array
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_programs
             WHERE series_id = ? AND end_time > ?
             ORDER BY start_time ASC
             LIMIT ?",
            [$seriesId, time(), $limit]
        );

        $programs = [];
        while ($row = $result->fetch()) {
            $programs[] = $this->mapProgram($row);
        }

        return $programs;
    }

    /**
     * Add or update a program.
     */
    public function upsertProgram(array $data): array
    {
        $programId = $data['program_id'] ?? $this->generateUuid();

        $this->db->query(
            "INSERT INTO livetv_programs
             (program_id, channel_id, title, description, start_time, end_time,
              category, series_id, episode_number, episode_title, rating_system,
              rating, year, series_episode, is_repeat, is_film, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE
                title = VALUES(title),
                description = VALUES(description),
                start_time = VALUES(start_time),
                end_time = VALUES(end_time),
                category = VALUES(category),
                series_id = VALUES(series_id),
                episode_number = VALUES(episode_number),
                episode_title = VALUES(episode_title),
                rating_system = VALUES(rating_system),
                rating = VALUES(rating),
                year = VALUES(year),
                series_episode = VALUES(series_episode),
                is_repeat = VALUES(is_repeat),
                is_film = VALUES(is_film),
                updated_at = NOW()",
            [
                $programId,
                $data['channel_id'],
                $data['title'] ?? 'Unknown',
                $data['description'] ?? null,
                $data['start_time'] ?? time(),
                $data['end_time'] ?? (time() + 3600),
                $data['category'] ?? self::CATEGORY_OTHER,
                $data['series_id'] ?? null,
                $data['episode_number'] ?? null,
                $data['episode_title'] ?? null,
                $data['rating_system'] ?? self::RATING_SYSTEM_TV,
                $data['rating'] ?? null,
                $data['year'] ?? null,
                $data['series_episode'] ?? null,
                $data['is_repeat'] ?? false,
                $data['is_film'] ?? false,
            ]
        );

        // Invalidate cache
        $this->invalidateCacheForChannel($data['channel_id']);

        $this->logger->debug('Program upserted', ['program_id' => $programId, 'title' => $data['title']]);

        return $this->getProgram($programId);
    }

    /**
     * Delete a program.
     */
    public function deleteProgram(string $programId): bool
    {
        $program = $this->getProgram($programId);
        if (!$program) {
            return false;
        }

        $this->db->query("DELETE FROM livetv_programs WHERE program_id = ?", [$programId]);

        // Invalidate cache
        $this->invalidateCacheForChannel($program['channel_id']);

        $this->logger->debug('Program deleted', ['program_id' => $programId]);

        return true;
    }

    /**
     * Clean up old program data.
     */
    public function cleanupOldPrograms(int $daysToKeep = 7): int
    {
        $cutoff = time() - ($daysToKeep * 86400);

        $result = $this->db->query(
            "DELETE FROM livetv_programs WHERE end_time < ?",
            [$cutoff]
        );

        $deleted = $this->db->affected_rows;

        if ($deleted > 0) {
            $this->logger->info('Cleaned up old programs', ['deleted' => $deleted, 'cutoff_days' => $daysToKeep]);
            $this->clearCache();
        }

        return $deleted;
    }

    /**
     * Import guide data from external source.
     */
    public function importGuideData(array $programs): array
    {
        $imported = 0;
        $errors = [];

        foreach ($programs as $data) {
            try {
                if (isset($data['channel_id']) && isset($data['start_time']) && isset($data['end_time'])) {
                    $this->upsertProgram($data);
                    $imported++;
                } else {
                    $errors[] = "Missing required fields: " . json_encode($data);
                }
            } catch (\Throwable $e) {
                $errors[] = "Error importing program: " . $e->getMessage();
            }
        }

        $this->logger->info('Guide data imported', ['imported' => $imported, 'errors' => count($errors)]);

        return [
            'imported' => $imported,
            'errors' => $errors,
        ];
    }

    /**
     * Export guide data for a time range.
     */
    public function exportGuideData(int $startTime, int $endTime): array
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_programs
             WHERE start_time >= ? AND start_time <= ?
             ORDER BY channel_id, start_time ASC",
            [$startTime, $endTime]
        );

        $programs = [];
        while ($row = $result->fetch()) {
            $programs[] = $this->mapProgram($row);
        }

        return $programs;
    }

    /**
     * Get guide data for a specific channel.
     */
    public function getChannelGuide(string $channelId, int $days = 7): array
    {
        $startTime = time();
        $endTime = $startTime + ($days * 86400);

        return $this->getProgramsForChannel($channelId, $startTime, $endTime);
    }

    /**
     * Set cache TTL.
     */
    public function setCacheTtl(int $seconds): void
    {
        $this->cacheTtl = $seconds;
    }

    /**
     * Clear the cache.
     */
    public function clearCache(): void
    {
        $this->cache = [];
        $this->logger->debug('Guide cache cleared');
    }

    /**
     * Get cache statistics.
     */
    public function getCacheStats(): array
    {
        return [
            'entries' => count($this->cache),
            'ttl' => $this->cacheTtl,
        ];
    }

    /**
     * Invalidate cache for a specific channel.
     */
    private function invalidateCacheForChannel(string $channelId): void
    {
        // Simple approach: clear all cache when data changes
        // A more sophisticated approach would track cache keys per channel
        $this->cache = [];
    }

    /**
     * Map a database row to a program array.
     */
    private function mapProgram(array $row): array
    {
        return [
            'id' => $row['program_id'],
            'program_id' => $row['program_id'],
            'channel_id' => $row['channel_id'],
            'title' => $row['title'],
            'description' => $row['description'],
            'start_time' => (int) $row['start_time'],
            'end_time' => (int) $row['end_time'],
            'duration' => (int) $row['end_time'] - (int) $row['start_time'],
            'category' => $row['category'],
            'series_id' => $row['series_id'],
            'episode_number' => $row['episode_number'] ? (int) $row['episode_number'] : null,
            'episode_title' => $row['episode_title'],
            'rating_system' => $row['rating_system'],
            'rating' => $row['rating'],
            'year' => $row['year'] ? (int) $row['year'] : null,
            'series_episode' => $row['series_episode'],
            'is_repeat' => (bool) $row['is_repeat'],
            'is_film' => (bool) $row['is_film'],
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
