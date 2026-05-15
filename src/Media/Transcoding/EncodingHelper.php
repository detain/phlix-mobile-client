<?php

namespace Phlex\Media\Transcoding;

class EncodingHelper
{
    public function getEncodingParams(array $sourceInfo, array $profile, array $options = []): array
    {
        $videoStream = $this->getVideoStream($sourceInfo);
        $audioStream = $this->getAudioStream($sourceInfo);

        $params = [];

        // Determine if transcoding is needed
        $needsTranscode = $this->needsTranscode($videoStream, $audioStream, $profile);

        if (!$needsTranscode) {
            // Direct play - no encoding needed
            return [
                'method' => 'direct',
                'video_codec' => $videoStream['codec'] ?? null,
                'audio_codec' => $audioStream['codec'] ?? null,
            ];
        }

        // Transcode required
        $params['method'] = 'transcode';

        // Select video codec based on profile
        $params['video_codec'] = $this->selectVideoCodec($profile, $videoStream);
        $params['preset'] = 'medium';
        $params['crf'] = $this->selectCrf($params['video_codec']);

        // Select resolution
        $maxRes = $profile['max_resolution'] ?? [1920, 1080];
        $sourceRes = [$videoStream['width'] ?? 1920, $videoStream['height'] ?? 1080];
        
        if ($sourceRes[0] > $maxRes[0] || $sourceRes[1] > $maxRes[1]) {
            $params['width'] = $maxRes[0];
            $params['height'] = $maxRes[1];
        }

        // Select audio codec
        $params['audio_codec'] = 'aac';
        $params['audio_bitrate'] = $this->selectAudioBitrate($profile);
        $params['audio_channels'] = min($audioStream['channels'] ?? 2, 6);
        $params['audio_sample_rate'] = 48000;

        // Container
        $params['container'] = 'ts';
        $params['format'] = 'mpegts';

        return $params;
    }

    private function needsTranscode(array $videoStream, array $audioStream, array $profile): bool
    {
        $videoCodec = strtolower($videoStream['codec'] ?? '');
        $directPlayCodecs = $profile['direct_play'] ?? ['h264', 'h265', 'vp9'];
        
        if (!in_array($videoCodec, $directPlayCodecs)) {
            return true;
        }

        // Check resolution
        $width = $videoStream['width'] ?? 0;
        $height = $videoStream['height'] ?? 0;
        [$maxWidth, $maxHeight] = $profile['max_resolution'] ?? [1920, 1080];

        if ($width > $maxWidth || $height > $maxHeight) {
            return true;
        }

        return false;
    }

    private function selectVideoCodec(array $profile, array $videoStream): string
    {
        $videoCodec = strtolower($videoStream['codec'] ?? '');
        $transcodeCodecs = $profile['transcode'] ?? ['h264'];

        // If source is H.265 but client only supports H.264, transcode
        if ($videoCodec === 'hevc' && !in_array('h264', $transcodeCodecs)) {
            return 'libx265';
        }

        // Default to H.264
        return 'libx264';
    }

    private function selectCrf(string $codec): int
    {
        return match($codec) {
            'libx264' => 23,
            'libx265' => 28,
            'libvpx-vp9' => 31,
            default => 23,
        };
    }

    private function selectAudioBitrate(array $profile): string
    {
        $maxBitrate = $profile['max_bitrate'] ?? 100000000;
        
        if ($maxBitrate < 2000000) {
            return '96k';
        } elseif ($maxBitrate < 5000000) {
            return '128k';
        } else {
            return '192k';
        }
    }

    private function getVideoStream(array $sourceInfo): array
    {
        foreach ($sourceInfo['streams'] ?? [] as $stream) {
            if (($stream['codec_type'] ?? '') === 'video') {
                return $stream;
            }
        }
        return [];
    }

    private function getAudioStream(array $sourceInfo): array
    {
        foreach ($sourceInfo['streams'] ?? [] as $stream) {
            if (($stream['codec_type'] ?? '') === 'audio') {
                return $stream;
            }
        }
        return [];
    }
}