<?php

namespace Phlex\LiveTv;

use Phlex\Common\Logger\LogChannels;
use Phlex\Common\Logger\LoggerFactory;
use Phlex\Common\Logger\StructuredLogger;
use Workerman\MySQL\Connection;

/**
 * Recorder - DVR scheduling and recording functionality.
 *
 * Provides functionality for:
 * - DVR scheduling and recording
 * - Recording storage management
 * - Time-shifting playback
 */
class Recorder
{
    private Connection $db;
    private StructuredLogger $logger;
    private string $storagePath;
    private int $maxStorageBytes;
    private array $activeRecordings = [];
    private array $activeTimeShifts = [];

    /**
     * Recording status constants.
     */
    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_RECORDING = 'recording';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    /**
     * Recording priority constants.
     */
    public const PRIORITY_LOW = 1;
    public const PRIORITY_NORMAL = 5;
    public const PRIORITY_HIGH = 10;

    /**
     * Time-shift buffer size in seconds.
     */
    public const TIMESHIFT_BUFFER_SECONDS = 7200; // 2 hours

    public function __construct(Connection $db, string $storagePath = '/var/recordings', int $maxStorageBytes = 0, ?StructuredLogger $logger = null)
    {
        $this->db = $db;
        $this->storagePath = $storagePath;
        $this->maxStorageBytes = $maxStorageBytes;
        $this->logger = $logger ?? LoggerFactory::get(LogChannels::LIVETV);
    }

    /**
     * Schedule a recording.
     */
    public function scheduleRecording(array $data): array
    {
        $recordingId = $this->generateUuid();

        $this->db->query(
            "INSERT INTO livetv_recordings
             (recording_id, channel_id, program_id, title, description, start_time, end_time,
              priority, quality, storage_path, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
            [
                $recordingId,
                $data['channel_id'],
                $data['program_id'] ?? null,
                $data['title'] ?? 'Untitled Recording',
                $data['description'] ?? null,
                $data['start_time'],
                $data['end_time'],
                $data['priority'] ?? self::PRIORITY_NORMAL,
                $data['quality'] ?? 'default',
                $this->getRecordingPath($recordingId),
                self::STATUS_SCHEDULED,
            ]
        );

        $this->logger->info('Recording scheduled', [
            'recording_id' => $recordingId,
            'title' => $data['title'],
            'start_time' => date('Y-m-d H:i', $data['start_time']),
        ]);

        return $this->getRecording($recordingId);
    }

    /**
     * Get a recording by ID.
     */
    public function getRecording(string $recordingId): ?array
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_recordings WHERE recording_id = ?",
            [$recordingId]
        );

        if ($result->num_rows === 0) {
            return null;
        }

        return $this->mapRecording($result->fetch());
    }

    /**
     * Get all recordings.
     */
    public function getAllRecordings(string $status = null): array
    {
        if ($status) {
            $result = $this->db->query(
                "SELECT * FROM livetv_recordings WHERE status = ? ORDER BY start_time DESC",
                [$status]
            );
        } else {
            $result = $this->db->query(
                "SELECT * FROM livetv_recordings ORDER BY start_time DESC"
            );
        }

        $recordings = [];
        while ($row = $result->fetch()) {
            $recordings[] = $this->mapRecording($row);
        }

        return $recordings;
    }

    /**
     * Get upcoming recordings.
     */
    public function getUpcomingRecordings(int $limit = 10): array
    {
        $now = time();

        $result = $this->db->query(
            "SELECT * FROM livetv_recordings
             WHERE status = ? AND start_time > ?
             ORDER BY start_time ASC
             LIMIT ?",
            [self::STATUS_SCHEDULED, $now, $limit]
        );

        $recordings = [];
        while ($row = $result->fetch()) {
            $recordings[] = $this->mapRecording($row);
        }

        return $recordings;
    }

    /**
     * Get recordings for a specific channel.
     */
    public function getRecordingsForChannel(string $channelId): array
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_recordings WHERE channel_id = ? ORDER BY start_time DESC",
            [$channelId]
        );

        $recordings = [];
        while ($row = $result->fetch()) {
            $recordings[] = $this->mapRecording($row);
        }

        return $recordings;
    }

    /**
     * Get user's recordings.
     */
    public function getUserRecordings(string $userId): array
    {
        $result = $this->db->query(
            "SELECT * FROM livetv_recordings WHERE user_id = ? ORDER BY start_time DESC",
            [$userId]
        );

        $recordings = [];
        while ($row = $result->fetch()) {
            $recordings[] = $this->mapRecording($row);
        }

        return $recordings;
    }

    /**
     * Start a recording.
     */
    public function startRecording(string $recordingId): bool
    {
        $recording = $this->getRecording($recordingId);
        if (!$recording || $recording['status'] !== self::STATUS_SCHEDULED) {
            return false;
        }

        // Check available storage
        if (!$this->hasStorageSpace($recording['start_time'], $recording['end_time'])) {
            $this->updateRecordingStatus($recordingId, self::STATUS_FAILED, 'Insufficient storage space');
            return false;
        }

        $this->updateRecordingStatus($recordingId, self::STATUS_RECORDING);

        $this->activeRecordings[$recordingId] = [
            'id' => $recordingId,
            'started_at' => time(),
            'channel_id' => $recording['channel_id'],
            'stream_url' => "/livetv/recording/$recordingId/stream",
        ];

        $this->logger->info('Recording started', ['recording_id' => $recordingId]);

        return true;
    }

    /**
     * Stop a recording.
     */
    public function stopRecording(string $recordingId): bool
    {
        if (!isset($this->activeRecordings[$recordingId])) {
            return false;
        }

        $recording = $this->getRecording($recordingId);
        if (!$recording) {
            return false;
        }

        $duration = time() - $this->activeRecordings[$recordingId]['started_at'];

        unset($this->activeRecordings[$recordingId]);

        // Update recording with actual end time and size
        $filePath = $this->getRecordingPath($recordingId);
        $fileSize = file_exists($filePath) ? filesize($filePath) : 0;

        $this->db->query(
            "UPDATE livetv_recordings
             SET status = ?, end_time = ?, storage_size = ?, updated_at = NOW()
             WHERE recording_id = ?",
            [self::STATUS_COMPLETED, time(), $fileSize, $recordingId]
        );

        $this->logger->info('Recording stopped', [
            'recording_id' => $recordingId,
            'duration' => $duration,
            'size' => $fileSize,
        ]);

        return true;
    }

    /**
     * Cancel a scheduled recording.
     */
    public function cancelRecording(string $recordingId): bool
    {
        $recording = $this->getRecording($recordingId);
        if (!$recording) {
            return false;
        }

        if ($recording['status'] === self::STATUS_RECORDING) {
            $this->stopRecording($recordingId);
        }

        $this->updateRecordingStatus($recordingId, self::STATUS_CANCELLED);

        $this->logger->info('Recording cancelled', ['recording_id' => $recordingId]);

        return true;
    }

    /**
     * Delete a recording.
     */
    public function deleteRecording(string $recordingId): bool
    {
        $recording = $this->getRecording($recordingId);
        if (!$recording) {
            return false;
        }

        // Stop if still recording
        if (isset($this->activeRecordings[$recordingId])) {
            $this->stopRecording($recordingId);
        }

        // Delete the file
        $filePath = $this->getRecordingPath($recordingId);
        if (file_exists($filePath)) {
            unlink($filePath);
        }

        // Delete from database
        $this->db->query("DELETE FROM livetv_recordings WHERE recording_id = ?", [$recordingId]);

        $this->logger->info('Recording deleted', ['recording_id' => $recordingId]);

        return true;
    }

    /**
     * Update recording status.
     */
    private function updateRecordingStatus(string $recordingId, string $status, string $error = null): void
    {
        $this->db->query(
            "UPDATE livetv_recordings SET status = ?, error_message = ?, updated_at = NOW()
             WHERE recording_id = ?",
            [$status, $error, $recordingId]
        );
    }

    /**
     * Get recording file path.
     */
    private function getRecordingPath(string $recordingId): string
    {
        return $this->storagePath . '/' . $recordingId . '.ts';
    }

    /**
     * Check if there's available storage space.
     */
    private function hasStorageSpace(int $startTime, int $endTime): bool
    {
        if ($this->maxStorageBytes <= 0) {
            return true; // No limit set
        }

        $usedStorage = $this->getUsedStorageBytes();
        $estimatedSize = $this->estimateRecordingSize($startTime, $endTime);

        return ($usedStorage + $estimatedSize) <= $this->maxStorageBytes;
    }

    /**
     * Get total used storage in bytes.
     */
    public function getUsedStorageBytes(): int
    {
        $result = $this->db->query(
            "SELECT SUM(storage_size) as total FROM livetv_recordings WHERE status = ?",
            [self::STATUS_COMPLETED]
        );

        $row = $result->fetch();
        return (int) ($row['total'] ?? 0);
    }

    /**
     * Get available storage in bytes.
     */
    public function getAvailableStorageBytes(): int
    {
        if ($this->maxStorageBytes <= 0) {
            return PHP_INT_MAX;
        }

        return max(0, $this->maxStorageBytes - $this->getUsedStorageBytes());
    }

    /**
     * Estimate recording size based on duration and quality.
     */
    private function estimateRecordingSize(int $startTime, int $endTime): int
    {
        $durationSeconds = $endTime - $startTime;
        // Estimate ~2MB per minute for HD recording
        $bytesPerSecond = 2 * 1024 * 1024 / 60;
        return (int) ($durationSeconds * $bytesPerSecond);
    }

    /**
     * Start time-shifting for a channel.
     */
    public function startTimeShift(string $sessionId, string $channelId): array
    {
        // Stop any existing time-shift for this session
        $this->stopTimeShift($sessionId);

        $timeShiftId = $this->generateUuid();
        $bufferStart = time() - self::TIMESHIFT_BUFFER_SECONDS;

        $this->activeTimeShifts[$sessionId] = [
            'id' => $timeShiftId,
            'session_id' => $sessionId,
            'channel_id' => $channelId,
            'started_at' => time(),
            'buffer_start' => $bufferStart,
            'buffer_end' => time(),
        ];

        $this->logger->info('Time-shift started', [
            'session_id' => $sessionId,
            'channel_id' => $channelId,
        ]);

        return [
            'time_shift_id' => $timeShiftId,
            'stream_url' => "/livetv/timeshift/$sessionId/stream",
            'buffer_start' => $bufferStart,
            'buffer_end' => time(),
        ];
    }

    /**
     * Stop time-shifting for a session.
     */
    public function stopTimeShift(string $sessionId): bool
    {
        if (!isset($this->activeTimeShifts[$sessionId])) {
            return false;
        }

        unset($this->activeTimeShifts[$sessionId]);

        $this->logger->info('Time-shift stopped', ['session_id' => $sessionId]);

        return true;
    }

    /**
     * Get time-shift info for a session.
     */
    public function getTimeShift(string $sessionId): ?array
    {
        return $this->activeTimeShifts[$sessionId] ?? null;
    }

    /**
     * Get playback position in a time-shift buffer.
     */
    public function getTimeShiftPosition(string $sessionId): ?int
    {
        if (!isset($this->activeTimeShifts[$sessionId])) {
            return null;
        }

        return $this->activeTimeShifts[$sessionId]['current_position'] ?? time();
    }

    /**
     * Seek in time-shift buffer.
     */
    public function seekTimeShift(string $sessionId, int $position): bool
    {
        if (!isset($this->activeTimeShifts[$sessionId])) {
            return false;
        }

        $timeShift = $this->activeTimeShifts[$sessionId];

        // Clamp position to buffer range
        $position = max($timeShift['buffer_start'], min($timeShift['buffer_end'], $position));

        $this->activeTimeShifts[$sessionId]['current_position'] = $position;

        return true;
    }

    /**
     * Get active recordings count.
     */
    public function getActiveRecordingCount(): int
    {
        return count($this->activeRecordings);
    }

    /**
     * Get active time-shifts count.
     */
    public function getActiveTimeShiftCount(): int
    {
        return count($this->activeTimeShifts);
    }

    /**
     * Get recording count by status.
     */
    public function getRecordingCountByStatus(): array
    {
        $result = $this->db->query(
            "SELECT status, COUNT(*) as cnt FROM livetv_recordings GROUP BY status"
        );

        $counts = [];
        while ($row = $result->fetch()) {
            $counts[$row['status']] = (int) $row['cnt'];
        }

        return $counts;
    }

    /**
     * Update recording priority.
     */
    public function updatePriority(string $recordingId, int $priority): bool
    {
        $this->db->query(
            "UPDATE livetv_recordings SET priority = ?, updated_at = NOW() WHERE recording_id = ?",
            [$priority, $recordingId]
        );

        return true;
    }

    /**
     * Get storage statistics.
     */
    public function getStorageStats(): array
    {
        return [
            'used_bytes' => $this->getUsedStorageBytes(),
            'available_bytes' => $this->getAvailableStorageBytes(),
            'max_bytes' => $this->maxStorageBytes,
            'active_recordings' => $this->getActiveRecordingCount(),
            'active_timeshifts' => $this->getActiveTimeShiftCount(),
            'recordings_by_status' => $this->getRecordingCountByStatus(),
        ];
    }

    /**
     * Map a database row to a recording array.
     */
    private function mapRecording(array $row): array
    {
        return [
            'id' => $row['recording_id'],
            'recording_id' => $row['recording_id'],
            'channel_id' => $row['channel_id'],
            'program_id' => $row['program_id'],
            'user_id' => $row['user_id'],
            'title' => $row['title'],
            'description' => $row['description'],
            'start_time' => (int) $row['start_time'],
            'end_time' => (int) $row['end_time'],
            'duration' => (int) $row['end_time'] - (int) $row['start_time'],
            'priority' => (int) $row['priority'],
            'quality' => $row['quality'],
            'storage_path' => $row['storage_path'],
            'storage_size' => (int) ($row['storage_size'] ?? 0),
            'status' => $row['status'],
            'error_message' => $row['error_message'],
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
