<?php

namespace Phlex\LiveTv;

use Phlex\Common\Logger\LogChannels;
use Phlex\Common\Logger\LoggerFactory;
use Phlex\Common\Logger\StructuredLogger;
use Workerman\MySQL\Connection;

/**
 * Live TV Manager - Manages tuner discovery, channel scanning, and TV functionality.
 *
 * This class provides the main interface for Live TV operations including:
 * - Tuner device discovery and management
 * - Channel scanning and tuning
 * - Integration with program guide
 */
class LiveTvManager
{
    private Connection $db;
    private ChannelManager $channelManager;
    private GuideManager $guideManager;
    private Recorder $recorder;
    private StructuredLogger $logger;
    private array $tuners = [];
    private array $activeTuneRequests = [];

    /**
     * Tuner status constants.
     */
    public const TUNER_STATUS_IDLE = 'idle';
    public const TUNER_STATUS_SCANNING = 'scanning';
    public const TUNER_STATUS_TUNING = 'tuning';
    public const TUNER_STATUS_STREAMING = 'streaming';
    public const TUNER_STATUS_ERROR = 'error';

    /**
     * Tuner types supported.
     */
    public const TUNER_TYPE_DVB_T = 'dvb_t';
    public const TUNER_TYPE_DVB_S = 'dvb_s';
    public const TUNER_TYPE_DVB_C = 'dvb_c';
    public const TUNER_TYPE_ATSC = 'atsc';

    public function __construct(
        Connection $db,
        ChannelManager $channelManager,
        GuideManager $guideManager,
        Recorder $recorder,
        ?StructuredLogger $logger = null
    ) {
        $this->db = $db;
        $this->channelManager = $channelManager;
        $this->guideManager = $guideManager;
        $this->recorder = $recorder;
        $this->logger = $logger ?? LoggerFactory::get(LogChannels::LIVETV);
    }

    /**
     * Discover available tuners on the system.
     *
     * @return array List of discovered tuners with their capabilities
     */
    public function discoverTuners(): array
    {
        $this->logger->info('Starting tuner discovery');

        $tuners = $this->scanForTuners();

        foreach ($tuners as $tuner) {
            $this->registerTuner($tuner);
        }

        $this->tuners = $tuners;
        $this->logger->info('Tuner discovery complete', ['count' => count($tuners)]);

        return $tuners;
    }

    /**
     * Scan the system for available tuner devices.
     *
     * @return array Discovered tuners
     */
    private function scanForTuners(): array
    {
        // In a real implementation, this would interact with kernel DVB drivers
        // or other tuner hardware APIs. For now, we return a simulated list.
        $tuners = [];

        // Check for DVB devices in /dev/dvb
        $dvbBase = '/dev/dvb';
        if (is_dir($dvbBase)) {
            $adapters = glob("$dvbBase/adapter*");
            foreach ($adapters as $adapter) {
                if (is_dir($adapter)) {
                    $adapterNum = preg_replace('/[^0-9]/', '', $adapter);
                    $frontend = "$adapter/frontend0";

                    if (file_exists($frontend)) {
                        $tuners[] = [
                            'id' => "dvb_$adapterNum",
                            'name' => "DVB Adapter $adapterNum",
                            'type' => $this->detectDvbType($frontend),
                            'status' => self::TUNER_STATUS_IDLE,
                            'adapter' => $adapterNum,
                            'frontend' => $frontend,
                            'capabilities' => $this->getTunerCapabilities($frontend),
                        ];
                    }
                }
            }
        }

        return $tuners;
    }

    /**
     * Detect the DVB type (terrestrial, satellite, cable).
     */
    private function detectDvbType(string $frontendPath): string
    {
        // Would read from frontend device caps in real implementation
        return self::TUNER_TYPE_DVB_T;
    }

    /**
     * Get tuner capabilities from frontend device.
     */
    private function getTunerCapabilities(string $frontendPath): array
    {
        return [
            'frequency_min' => 45000000,
            'frequency_max' => 862000000,
            'symbol_rate_min' => 1000000,
            'symbol_rate_max' => 45000000,
        ];
    }

    /**
     * Register a tuner in the database.
     */
    private function registerTuner(array $tuner): void
    {
        $this->db->query(
            "INSERT INTO livetv_tuners (tuner_id, name, type, status, capabilities, discovered_at)
             VALUES (?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), status = VALUES(status)",
            [
                $tuner['id'],
                $tuner['name'],
                $tuner['type'],
                $tuner['status'],
                json_encode($tuner['capabilities']),
            ]
        );
    }

    /**
     * Scan for available channels.
     *
     * @param string $tunerId The tuner to use for scanning
     * @param array $options Scan options (frequency range, symbol rate, etc.)
     * @return array Scan results with discovered channels
     */
    public function scanChannels(string $tunerId, array $options = []): array
    {
        $tuner = $this->getTuner($tunerId);
        if (!$tuner) {
            throw new \InvalidArgumentException("Tuner not found: $tunerId");
        }

        $this->updateTunerStatus($tunerId, self::TUNER_STATUS_SCANNING);
        $this->logger->info('Starting channel scan', ['tuner_id' => $tunerId]);

        $channels = $this->performChannelScan($tuner, $options);

        $this->updateTunerStatus($tunerId, self::TUNER_STATUS_IDLE);
        $this->logger->info('Channel scan complete', ['tuner_id' => $tunerId, 'channels_found' => count($channels)]);

        return $channels;
    }

    /**
     * Get a tuner by ID.
     */
    public function getTuner(string $tunerId): ?array
    {
        foreach ($this->tuners as $tuner) {
            if ($tuner['id'] === $tunerId) {
                return $tuner;
            }
        }
        return null;
    }

    /**
     * Get all registered tuners.
     */
    public function getTuners(): array
    {
        return $this->tuners;
    }

    /**
     * Update tuner status.
     */
    private function updateTunerStatus(string $tunerId, string $status): void
    {
        $this->db->query(
            "UPDATE livetv_tuners SET status = ?, updated_at = NOW() WHERE tuner_id = ?",
            [$status, $tunerId]
        );

        foreach ($this->tuners as &$tuner) {
            if ($tuner['id'] === $tunerId) {
                $tuner['status'] = $status;
                break;
            }
        }
    }

    /**
     * Perform the actual channel scan.
     */
    private function performChannelScan(array $tuner, array $options): array
    {
        // Simulated channel scan - in real implementation would tune to
        // frequencies and detect services
        $discoveredChannels = [];

        $frequencies = $options['frequencies'] ?? [474000000, 498000000, 522000000, 570000000];

        foreach ($frequencies as $frequency) {
            $services = $this->scanFrequency($tuner, $frequency);
            foreach ($services as $service) {
                $channel = $this->channelManager->createChannel([
                    'name' => $service['name'],
                    'number' => $service['number'],
                    'type' => $service['type'],
                    'frequency' => $frequency,
                    'tuner_id' => $tuner['id'],
                    'service_id' => $service['id'],
                ]);

                if ($channel) {
                    $discoveredChannels[] = $channel;
                }
            }
        }

        return $discoveredChannels;
    }

    /**
     * Scan a specific frequency for services.
     */
    private function scanFrequency(array $tuner, int $frequency): array
    {
        // Simulated - would actually tune and read PAT/SDT tables
        return [];
    }

    /**
     * Tune to a channel.
     *
     * @param string $channelId Channel to tune to
     * @param string $tunerId Optional specific tuner to use
     * @return array Tune result with stream URL
     */
    public function tuneToChannel(string $channelId, ?string $tunerId = null): array
    {
        $channel = $this->channelManager->getChannel($channelId);
        if (!$channel) {
            throw new \InvalidArgumentException("Channel not found: $channelId");
        }

        // Find an available tuner
        $tuner = $this->findAvailableTuner($tunerId);
        if (!$tuner) {
            throw new \RuntimeException('No available tuner');
        }

        $this->updateTunerStatus($tuner['id'], self::TUNER_STATUS_TUNING);

        // Generate unique tune request ID
        $tuneRequestId = $this->generateUuid();

        $this->activeTuneRequests[$tuneRequestId] = [
            'id' => $tuneRequestId,
            'channel_id' => $channelId,
            'tuner_id' => $tuner['id'],
            'started_at' => time(),
            'stream_url' => "/livetv/$tuneRequestId/stream",
        ];

        $this->updateTunerStatus($tuner['id'], self::TUNER_STATUS_STREAMING);

        $this->logger->info('Tuned to channel', [
            'tune_request_id' => $tuneRequestId,
            'channel_id' => $channelId,
            'tuner_id' => $tuner['id'],
        ]);

        return $this->activeTuneRequests[$tuneRequestId];
    }

    /**
     * Find an available tuner.
     */
    private function findAvailableTuner(?string $preferredTunerId = null): ?array
    {
        // If a specific tuner is requested and available, use it
        if ($preferredTunerId) {
            foreach ($this->tuners as $tuner) {
                if ($tuner['id'] === $preferredTunerId && $tuner['status'] === self::TUNER_STATUS_IDLE) {
                    return $tuner;
                }
            }
            return null;
        }

        // Find any idle tuner
        foreach ($this->tuners as $tuner) {
            if ($tuner['status'] === self::TUNER_STATUS_IDLE) {
                return $tuner;
            }
        }

        return null;
    }

    /**
     * Stop tuning and release the tuner.
     */
    public function stopTuning(string $tuneRequestId): void
    {
        if (!isset($this->activeTuneRequests[$tuneRequestId])) {
            return;
        }

        $request = $this->activeTuneRequests[$tuneRequestId];
        $this->updateTunerStatus($request['tuner_id'], self::TUNER_STATUS_IDLE);

        unset($this->activeTuneRequests[$tuneRequestId]);

        $this->logger->info('Stopped tuning', ['tune_request_id' => $tuneRequestId]);
    }

    /**
     * Get current tune request status.
     */
    public function getTuneRequest(string $tuneRequestId): ?array
    {
        return $this->activeTuneRequests[$tuneRequestId] ?? null;
    }

    /**
     * Get active tune requests.
     */
    public function getActiveTuneRequests(): array
    {
        return array_values($this->activeTuneRequests);
    }

    /**
     * Get the ChannelManager instance.
     */
    public function getChannelManager(): ChannelManager
    {
        return $this->channelManager;
    }

    /**
     * Get the GuideManager instance.
     */
    public function getGuideManager(): GuideManager
    {
        return $this->guideManager;
    }

    /**
     * Get the Recorder instance.
     */
    public function getRecorder(): Recorder
    {
        return $this->recorder;
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
