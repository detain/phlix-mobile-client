<?php

declare(strict_types=1);

namespace Phlex\Session\SyncPlay;

/**
 * TimeSync - Network time synchronization for synchronized playback
 *
 * Implements NTP-style time synchronization with latency compensation
 * and drift correction for SyncPlay group watching functionality.
 */
class TimeSync
{
    private const DEFAULT_PORT = 8098;
    private const PROTOCOL_VERSION = 1;

    // Timing window for ping/pong exchange (milliseconds)
    private const PING_WINDOW = 5000;

    // Maximum acceptable round-trip time (milliseconds)
    private const MAX_ACCEPTABLE_RTT = 1000;

    // Number of samples to average for time offset calculation
    private const OFFSET_SAMPLE_COUNT = 5;

    // Drift correction factor (lower = smoother but slower to adapt)
    private const DRIFT_CORRECTION_FACTOR = 0.1;

    private ?int $serverTimeOffset = null;
    private ?int $estimatedLatency = null;
    private array $offsetSamples = [];
    private float $lastSyncTimestamp = 0;
    private float $localDriftRate = 1.0;

    public function __construct(
        private readonly ?string $host = null,
        private readonly int $port = self::DEFAULT_PORT
    ) {
    }

    /**
     * Get the protocol version for time sync messages
     */
    public function getProtocolVersion(): int
    {
        return self::PROTOCOL_VERSION;
    }

    /**
     * Get the default port for time sync
     */
    public function getPort(): int
    {
        return $this->port;
    }

    /**
     * Get the host for time sync server
     */
    public function getHost(): ?string
    {
        return $this->host;
    }

    /**
     * Process an incoming ping message and return pong response data
     *
     * @param array $payload The ping payload containing client timestamp
     * @return array Pong response data with server timestamp and latency info
     */
    public function processPing(array $payload): array
    {
        $clientTimestamp = $payload['client_time'] ?? 0;
        $serverReceiveTime = (int)(microtime(true) * 1000);

        return [
            'type' => 'pong',
            'client_time' => $clientTimestamp,
            'server_time' => $serverReceiveTime,
            'protocol_version' => self::PROTOCOL_VERSION,
        ];
    }

    /**
     * Process a pong response from server and calculate time offset
     *
     * @param array $payload The pong payload containing timestamps
     * @return array Time sync result with offset and latency
     */
    public function processPong(array $payload): array
    {
        $clientSendTime = $payload['client_time'] ?? 0;
        $serverTime = $payload['server_time'] ?? 0;
        $serverReceiveTime = $payload['server_receive_time'] ?? 0;
        $clientReceiveTime = (int)(microtime(true) * 1000);

        // Calculate round-trip time
        $rtt = $clientReceiveTime - $clientSendTime - ($serverReceiveTime - $serverTime);
        $oneWayLatency = $rtt / 2;

        // Calculate time offset (how far client clock is from server clock)
        // offset = server_time - client_time + estimated_latency
        $offset = $serverTime - $clientSendTime + (int)$oneWayLatency;

        // Add sample to collection
        $this->addOffsetSample($offset, $rtt);

        // Update drift rate based on recent samples
        $this->updateDriftRate();

        return [
            'offset' => $this->getTimeOffset(),
            'latency' => $this->getEstimatedLatency(),
            'rtt' => $rtt,
            'is_stable' => $this->isSyncStable(),
        ];
    }

    /**
     * Add an offset sample to the collection
     */
    private function addOffsetSample(int $offset, int $rtt): void
    {
        // Only use samples with acceptable RTT
        if ($rtt > self::MAX_ACCEPTABLE_RTT) {
            return;
        }

        $this->offsetSamples[] = [
            'offset' => $offset,
            'rtt' => $rtt,
            'timestamp' => microtime(true),
        ];

        // Keep only recent samples
        if (count($this->offsetSamples) > self::OFFSET_SAMPLE_COUNT * 2) {
            array_shift($this->offsetSamples);
        }
    }

    /**
     * Calculate and update the local clock drift rate
     */
    private function updateDriftRate(): void
    {
        if (count($this->offsetSamples) < 2) {
            return;
        }

        $recent = array_slice($this->offsetSamples, -self::OFFSET_SAMPLE_COUNT);

        if (count($recent) < 2) {
            return;
        }

        $first = $recent[0];
        $last = $recent[count($recent) - 1];

        $timeDelta = $last['timestamp'] - $first['timestamp'];
        if ($timeDelta <= 0) {
            return;
        }

        $offsetDelta = $last['offset'] - $first['offset'];
        // Drift rate: how much does offset change per second
        $driftRate = $offsetDelta / $timeDelta;

        // Smooth the drift rate with EMA
        $this->localDriftRate = 1.0 + (self::DRIFT_CORRECTION_FACTOR * $driftRate / 1000);
    }

    /**
     * Get the current estimated time offset from server
     */
    public function getTimeOffset(): int
    {
        if (empty($this->offsetSamples)) {
            return 0;
        }

        // Return weighted average of recent samples (favor lower RTT)
        $weightedSum = 0;
        $weightSum = 0;

        $recent = array_slice($this->offsetSamples, -self::OFFSET_SAMPLE_COUNT);

        foreach ($recent as $sample) {
            $weight = 1 / max(1, $sample['rtt']);
            $weightedSum += $sample['offset'] * $weight;
            $weightSum += $weight;
        }

        return (int)($weightedSum / max(1, $weightSum));
    }

    /**
     * Get the estimated one-way latency to server
     */
    public function getEstimatedLatency(): int
    {
        if (empty($this->offsetSamples)) {
            return 0;
        }

        $recent = array_slice($this->offsetSamples, -self::OFFSET_SAMPLE_COUNT);

        $totalLatency = 0;
        $count = 0;

        foreach ($recent as $sample) {
            $totalLatency += $sample['rtt'] / 2;
            $count++;
        }

        return (int)($totalLatency / max(1, $count));
    }

    /**
     * Check if time synchronization is stable (enough samples with low variance)
     */
    public function isSyncStable(): bool
    {
        if (count($this->offsetSamples) < self::OFFSET_SAMPLE_COUNT) {
            return false;
        }

        $recent = array_slice($this->offsetSamples, -self::OFFSET_SAMPLE_COUNT);

        $offsets = array_column($recent, 'offset');
        $mean = array_sum($offsets) / count($offsets);

        $varianceSum = 0;
        foreach ($offsets as $offset) {
            $diff = $offset - $mean;
            $varianceSum += $diff * $diff;
        }
        $variance = $varianceSum / count($offsets);

        // Consider stable if variance is less than 50ms
        return $variance < 50;
    }

    /**
     * Get the local drift rate
     */
    public function getDriftRate(): float
    {
        return $this->localDriftRate;
    }

    /**
     * Get estimated synchronized time (local time adjusted by offset)
     */
    public function getSynchronizedTime(): int
    {
        $localTime = (int)(microtime(true) * 1000);
        return $localTime + $this->getTimeOffset();
    }

    /**
     * Convert a local timestamp to synchronized timestamp
     */
    public function localToSynchronized(int $localTimestamp): int
    {
        return $localTimestamp + $this->getTimeOffset();
    }

    /**
     * Convert a synchronized timestamp to local time
     */
    public function synchronizedToLocal(int $synchronizedTimestamp): int
    {
        return $synchronizedTimestamp - $this->getTimeOffset();
    }

    /**
     * Apply drift correction to a predicted playback position
     *
     * @param int $targetTime The target synchronized time
     * @param int $currentTime The current local time
     * @return int Corrected target time accounting for drift
     */
    public function applyDriftCorrection(int $targetTime, int $currentTime): int
    {
        $timeDelta = $targetTime - $currentTime;
        return (int)($targetTime + ($timeDelta * (1 - $this->localDriftRate)));
    }

    /**
     * Calculate the expected playback position with time sync
     *
     * @param int $playbackPosition Local playback position in milliseconds
     * @param int $mediaDuration Total media duration in milliseconds
     * @return int Adjusted position accounting for sync
     */
    public function adjustPlaybackPosition(int $playbackPosition, int $mediaDuration): int
    {
        $synchronizedTime = $this->getSynchronizedTime();
        $driftAdjustment = (int)(($synchronizedTime - time() * 1000) * $this->localDriftRate);

        $adjustedPosition = $playbackPosition + $driftAdjustment;

        // Clamp to valid range
        return max(0, min($adjustedPosition, $mediaDuration));
    }

    /**
     * Reset time sync state
     */
    public function reset(): void
    {
        $this->offsetSamples = [];
        $this->serverTimeOffset = null;
        $this->estimatedLatency = null;
        $this->localDriftRate = 1.0;
        $this->lastSyncTimestamp = 0;
    }

    /**
     * Get time sync status information
     */
    public function getStatus(): array
    {
        return [
            'offset' => $this->getTimeOffset(),
            'latency' => $this->getEstimatedLatency(),
            'drift_rate' => $this->localDriftRate,
            'is_stable' => $this->isSyncStable(),
            'sample_count' => count($this->offsetSamples),
            'last_sync' => $this->lastSyncTimestamp,
        ];
    }

    /**
     * Serialize time sync state for persistence
     */
    public function serialize(): array
    {
        return [
            'offset_samples' => $this->offsetSamples,
            'drift_rate' => $this->localDriftRate,
            'last_sync' => $this->lastSyncTimestamp,
        ];
    }

    /**
     * Restore time sync state from serialized data
     */
    public function unserialize(array $data): void
    {
        $this->offsetSamples = $data['offset_samples'] ?? [];
        $this->localDriftRate = $data['drift_rate'] ?? 1.0;
        $this->lastSyncTimestamp = $data['last_sync'] ?? 0;
    }
}
