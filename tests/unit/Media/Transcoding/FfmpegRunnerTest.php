<?php

namespace Phlex\Tests\Unit\Media\Transcoding;

use PHPUnit\Framework\TestCase;
use Phlex\Media\Transcoding\FfmpegRunner;

class FfmpegRunnerTest extends TestCase
{
    public function testCanCreateFfmpegRunner(): void
    {
        $runner = new FfmpegRunner('/usr/bin/ffmpeg', '/usr/bin/ffprobe', '/tmp');
        
        $this->assertInstanceOf(FfmpegRunner::class, $runner);
    }

    public function testBuildTranscodeCommand(): void
    {
        $runner = new FfmpegRunner('/usr/bin/ffmpeg', '/usr/bin/ffprobe', '/tmp');
        
        $params = [
            'video_codec' => 'libx264',
            'preset' => 'medium',
            'crf' => 23,
            'width' => 1920,
            'height' => 1080,
            'audio_codec' => 'aac',
            'audio_bitrate' => '192k',
            'container' => 'mp4',
        ];
        
        $cmd = $runner->buildTranscodeCommand('/input.mkv', '/output.mp4', $params);
        
        $this->assertStringContainsString('libx264', $cmd);
        $this->assertStringContainsString('aac', $cmd);
        $this->assertStringContainsString('/input.mkv', $cmd);
        $this->assertStringContainsString('/output.mp4', $cmd);
    }

    public function testIsAvailableReturnsFalseForNonexistentBinary(): void
    {
        $runner = new FfmpegRunner('/nonexistent/ffmpeg', '/nonexistent/ffprobe', '/tmp');
        
        $this->assertFalse($runner->isAvailable());
    }
}