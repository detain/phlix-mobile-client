<?php

namespace Phlex\Media\Metadata;

use Phlex\Common\Logger\LoggerFactory;
use Phlex\Common\Logger\LogChannels;

class MetadataHttpClient
{
    private string $baseUrl;
    private string $apiKey;
    private int $timeout;
    private \Phlex\Common\Logger\StructuredLogger $logger;
    private array $cache = [];

    public function __construct(string $baseUrl, string $apiKey, int $timeout = 10)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiKey = $apiKey;
        $this->timeout = $timeout;
        $this->logger = LoggerFactory::get(LogChannels::MEDIA);
    }

    public function get(string $endpoint, array $params = []): ?array
    {
        $cacheKey = md5($endpoint . json_encode($params));
        
        if (isset($this->cache[$cacheKey])) {
            return $this->cache[$cacheKey];
        }

        $params['api_key'] = $this->apiKey;
        $url = $this->baseUrl . '/' . ltrim($endpoint, '/') . '?' . http_build_query($params);

        $context = stream_context_create([
            'http' => [
                'timeout' => $this->timeout,
                'ignore_errors' => true,
            ],
        ]);

        $response = @file_get_contents($url, false, $context);

        if ($response === false) {
            $this->logger->error('Metadata HTTP request failed', [
                'url' => $url,
                'error' => error_get_last()['message'] ?? 'Unknown error',
            ]);
            return null;
        }

        $data = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->logger->error('Invalid JSON response from metadata API', [
                'url' => $url,
                'json_error' => json_last_error_msg(),
            ]);
            return null;
        }

        $this->cache[$cacheKey] = $data;
        return $data;
    }

    public function clearCache(): void
    {
        $this->cache = [];
    }
}