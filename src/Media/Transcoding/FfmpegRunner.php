<?php

namespace Phlex\Media\Transcoding;

use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

class FfmpegRunner
{
    private string $ffmpegPath;
    private string $ffprobePath;
    private string $transcodeDir;
    private LoggerInterface $logger;

    public function __construct(
        string $ffmpegPath = '/usr/bin/ffmpeg',
        string $ffprobePath = '/usr/bin/ffprobe',
        string $transcodeDir = '/var/transcodes',
        ?LoggerInterface $logger = null
    ) {
        $this->ffmpegPath = $ffmpegPath;
        $this->ffprobePath = $ffprobePath;
        $this->transcodeDir = $transcodeDir;
        $this->logger = $logger ?? new NullLogger();
    }

    public function probe(string $inputPath): ?array
    {
        $cmd = sprintf(
            '%s -v quiet -print_format json -show_format -show_streams %s 2>/dev/null',
            escapeshellarg($this->ffprobePath),
            escapeshellarg($inputPath)
        );

        $output = shell_exec($cmd);
        if (!$output) {
            return null;
        }

        $data = json_decode($output, true);
        return is_array($data) ? $data : null;
    }

    public function transcode(string $inputPath, string $outputPath, array $params): bool
    {
        $cmd = $this->buildTranscodeCommand($inputPath, $outputPath, $params);
        
        $this->logger->debug('Starting transcode', ['command' => $cmd]);
        
        $descriptorSpec = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open($cmd, $descriptorSpec, $pipes);
        
        if (!is_resource($process)) {
            $this->logger->error('Failed to start transcode process');
            return false;
        }

        // Close stdin
        fclose($pipes[0]);
        
        // Read output (could be async in real implementation)
        $stderr = stream_get_contents($pipes[2]);
        fclose($pipes[2]);
        
        $exitCode = proc_close($process);
        
        if ($exitCode !== 0) {
            $this->logger->error('Transcode failed', ['exit_code' => $exitCode, 'stderr' => $stderr]);
            return false;
        }

        return true;
    }

    public function buildTranscodeCommand(string $inputPath, string $outputPath, array $params): string
    {
        $cmd = sprintf(
            '%s -y -hide_banner -loglevel error',
            escapeshellarg($this->ffmpegPath)
        );

        // Input
        $cmd .= ' -i ' . escapeshellarg($inputPath);

        // Video codec
        if (isset($params['video_codec'])) {
            $cmd .= ' -c:v ' . $params['video_codec'];
            
            switch ($params['video_codec']) {
                case 'libx264':
                    $cmd .= ' -preset ' . ($params['preset'] ?? 'medium');
                    $cmd .= ' -crf ' . ($params['crf'] ?? 23);
                    break;
                case 'libx265':
                    $cmd .= ' -preset ' . ($params['preset'] ?? 'medium');
                    $cmd .= ' -crf ' . ($params['crf'] ?? 28);
                    break;
            }
        }

        // Video filters (scale, pad)
        if (isset($params['width']) && isset($params['height'])) {
            $scaleFilter = "scale={$params['width']}:{$params['height']}:force_original_aspect_ratio=decrease";
            $cmd .= ' -vf "' . $scaleFilter . '"';
        }

        // Audio codec
        if (isset($params['audio_codec'])) {
            $cmd .= ' -c:a ' . $params['audio_codec'];
            $cmd .= ' -b:a ' . ($params['audio_bitrate'] ?? '128k');
            $cmd .= ' -ar ' . ($params['audio_sample_rate'] ?? 48000);
            
            if (isset($params['audio_channels'])) {
                $cmd .= ' -ac ' . $params['audio_channels'];
            }
        } else {
            $cmd .= ' -c:a copy';
        }

        // Output format/container
        if (isset($params['format'])) {
            $cmd .= ' -f ' . $params['format'];
        }

        // Faststart for MP4
        if (($params['container'] ?? '') === 'mp4') {
            $cmd .= ' -movflags +faststart';
        }

        // Threads
        $cmd .= ' -threads 0';

        // Output
        $cmd .= ' ' . escapeshellarg($outputPath);

        return $cmd;
    }

    public function generateThumbnail(string $inputPath, string $outputPath, int $timeSeconds = 10): bool
    {
        $cmd = sprintf(
            '%s -y -hide_banner -loglevel error -i %s -ss %d -vframes 1 -q:v 2 -f image2 %s',
            escapeshellarg($this->ffmpegPath),
            escapeshellarg($inputPath),
            $timeSeconds,
            escapeshellarg($outputPath)
        );

        exec($cmd, $output, $exitCode);
        return $exitCode === 0;
    }

    public function extractSubtitle(string $inputPath, string $outputPath, int $streamIndex = 0): bool
    {
        $cmd = sprintf(
            '%s -y -hide_banner -loglevel error -i %s -map 0:s:%d -c:s copy %s',
            escapeshellarg($this->ffmpegPath),
            escapeshellarg($inputPath),
            $streamIndex,
            escapeshellarg($outputPath)
        );

        exec($cmd, $output, $exitCode);
        return $exitCode === 0;
    }

    public function isAvailable(): bool
    {
        return file_exists($this->ffmpegPath) && is_executable($this->ffmpegPath);
    }

    public function getVersion(): ?string
    {
        if (!$this->isAvailable()) {
            return null;
        }

        $output = shell_exec(escapeshellarg($this->ffmpegPath) . ' -version 2>/dev/null');
        if (preg_match('/ffmpeg version (\S+)/', $output, $matches)) {
            return $matches[1];
        }
        return null;
    }
}