<?php

namespace Phlex\Media\Transcoding;

use Phlex\Common\Database\Connection;
use Phlex\Media\Streaming\StreamState;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

class TranscodeManager
{
    private Connection $db;
    private FfmpegRunner $ffmpeg;
    private EncodingHelper $encodingHelper;
    private string $transcodeDir;
    private string $segmentDir;
    private array $activeJobs = [];
    private int $maxConcurrentTranscodes;
    private LoggerInterface $logger;

    public function __construct(
        Connection $db,
        FfmpegRunner $ffmpeg,
        EncodingHelper $encodingHelper,
        string $transcodeDir,
        string $segmentDir,
        ?LoggerInterface $logger = null
    ) {
        $this->db = $db;
        $this->ffmpeg = $ffmpeg;
        $this->encodingHelper = $encodingHelper;
        $this->transcodeDir = $transcodeDir;
        $this->segmentDir = $segmentDir;
        $this->maxConcurrentTranscodes = 4;
        $this->logger = $logger ?? new NullLogger();
    }

    public function startTranscode(StreamState $state, array $options = []): string
    {
        $jobId = $this->generateUuid();
        
        // Create output directory
        $outputDir = "{$this->transcodeDir}/{$jobId}";
        mkdir($outputDir, 0755, true);
        
        // Get media item
        $item = $this->getMediaItem($state->mediaItemId);
        if (!$item) {
            throw new \InvalidArgumentException("Media item not found");
        }

        // Probe source
        $sourceInfo = $this->ffmpeg->probe($item['path']);
        if (!$sourceInfo) {
            throw new \RuntimeException("Failed to probe media file");
        }

        // Get encoding parameters
        $profile = $options['device_profile'] ?? [];
        $encodingParams = $this->encodingHelper->getEncodingParams($sourceInfo, $profile, $options);

        // Build output path
        $container = $encodingParams['container'] ?? 'ts';
        $outputPath = "{$outputDir}/output.{$container}";

        // Create transcode job record
        $this->db->query(
            "INSERT INTO transcode_jobs (id, media_item_id, input_path, output_path, status) VALUES (?, ?, ?, ?, 'running')",
            [$jobId, $state->mediaItemId, $item['path'], $outputPath]
        );

        // Start transcode process (async in real implementation)
        $success = $this->ffmpeg->transcode($item['path'], $outputPath, $encodingParams);

        if (!$success) {
            $this->db->query("UPDATE transcode_jobs SET status = 'failed' WHERE id = ?", [$jobId]);
            throw new \RuntimeException("Transcode failed");
        }

        $this->activeJobs[$jobId] = [
            'id' => $jobId,
            'state' => $state,
            'output_path' => $outputPath,
            'encoding_params' => $encodingParams,
            'started_at' => time(),
        ];

        $this->logger->info('Transcode started', ['job_id' => $jobId]);

        return $jobId;
    }

    public function stopTranscode(string $jobId): void
    {
        if (!isset($this->activeJobs[$jobId])) {
            return;
        }

        // Kill process if running
        $job = $this->activeJobs[$jobId];
        
        // Delete output files
        $dir = dirname($job['output_path']);
        if (is_dir($dir)) {
            array_map('unlink', glob("{$dir}/*"));
            rmdir($dir);
        }

        // Update database
        $this->db->query("UPDATE transcode_jobs SET status = 'cancelled' WHERE id = ?", [$jobId]);

        unset($this->activeJobs[$jobId]);

        $this->logger->info('Transcode cancelled', ['job_id' => $jobId]);
    }

    public function getTranscodeStatus(string $jobId): ?array
    {
        if (isset($this->activeJobs[$jobId])) {
            return [
                'id' => $jobId,
                'status' => 'running',
                'output_path' => $this->activeJobs[$jobId]['output_path'],
            ];
        }

        $result = $this->db->query("SELECT * FROM transcode_jobs WHERE id = ?", [$jobId]);
        return $result[0] ?? null;
    }

    public function getActiveTranscodeCount(): int
    {
        return count(array_filter($this->activeJobs, fn($j) => $j['status'] === 'running'));
    }

    public function cleanupStaleJobs(int $maxAgeSeconds = 3600): void
    {
        $cutoff = time() - $maxAgeSeconds;
        
        foreach ($this->activeJobs as $jobId => $job) {
            if ($job['started_at'] < $cutoff) {
                $this->stopTranscode($jobId);
                $this->logger->warning('Cleaned up stale transcode job', ['job_id' => $jobId]);
            }
        }
    }

    private function getMediaItem(string $itemId): ?array
    {
        $result = $this->db->query("SELECT * FROM media_items WHERE id = ?", [$itemId]);
        return $result[0] ?? null;
    }

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