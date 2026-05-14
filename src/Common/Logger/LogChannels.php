<?php

namespace Phlex\Common\Logger;

/**
 * Log channel constants for consistent logger naming.
 */
final class LogChannels
{
    public const APPLICATION = 'application';
    public const HTTP = 'http';
    public const WEBSOCKET = 'websocket';
    public const DATABASE = 'database';
    public const MEDIA = 'media';
    public const STREAMING = 'streaming';
    public const TRANSCODING = 'transcoding';
    public const AUTH = 'auth';
    public const SESSION = 'session';
    public const AUDIT = 'audit';
    public const DLNA = 'dlna';
    public const LIVETV = 'livetv';
    
    private function __construct()
    {
        // Prevent instantiation
    }
}

/**
 * Trait for classes that need logging capability.
 */
trait HasLogger
{
    private ?StructuredLogger $logger = null;

    protected function setLogger(StructuredLogger $logger): void
    {
        $this->logger = $logger;
    }

    protected function getLogger(): StructuredLogger
    {
        if ($this->logger === null) {
            $this->logger = LoggerFactory::get(LogChannels::APPLICATION);
        }
        return $this->logger;
    }
}