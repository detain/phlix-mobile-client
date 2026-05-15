<?php

namespace Phlex\Media\Metadata;

use Workerman\MySQL\Connection;
use Phlex\Common\Logger\LoggerFactory;
use Phlex\Common\Logger\LogChannels;
use Phlex\Media\Library\ItemRepository;

class MetadataManager
{
    private Connection $db;
    private ItemRepository $itemRepository;
    private array $providers = [];
    private \Phlex\Common\Logger\StructuredLogger $logger;

    public function __construct(Connection $db, ItemRepository $itemRepository)
    {
        $this->db = $db;
        $this->itemRepository = $itemRepository;
        $this->logger = LoggerFactory::get(LogChannels::MEDIA);
    }

    public function registerProvider(string $type, MetadataProviderInterface $provider): void
    {
        $this->providers[$type] = $provider;
        $this->logger->info('Registered metadata provider', ['type' => $type]);
    }

    public function refreshItemMetadata(string $itemId): bool
    {
        $item = $this->itemRepository->findById($itemId);
        if (!$item) {
            $this->logger->warning('Cannot refresh metadata - item not found', ['item_id' => $itemId]);
            return false;
        }

        $type = $this->getProviderType($item['type']);
        if (!isset($this->providers[$type])) {
            $this->logger->debug('No provider for item type', ['type' => $item['type']]);
            return false;
        }

        $provider = $this->providers[$type];
        $metadata = $this->parseMetadataJson($item['metadata_json'] ?? '{}');

        // Search for match
        $searchQuery = $metadata['name'] ?? $item['name'];
        $year = $metadata['year'] ?? null;

        $results = $provider->search($searchQuery, ['year' => $year]);
        if (empty($results)) {
            $this->logger->info('No metadata results found', ['item' => $searchQuery]);
            return false;
        }

        // Get best match (first result)
        $match = $results[0];
        $externalId = $match['id'];

        // Fetch full details
        $details = $provider->getDetails($externalId);
        if (empty($details)) {
            return false;
        }

        // Fetch images
        $images = $provider->getImages($externalId);

        // Update item with metadata
        $this->itemRepository->update($itemId, [
            'name' => $details['name'] ?? $item['name'],
            'metadata_json' => json_encode(array_merge($metadata, [
                'external_ids' => [
                    'tmdb' => $externalId,
                ],
                'details' => $details,
                'images' => $images,
                'metadata_refreshed_at' => date('c'),
            ])),
        ]);

        $this->logger->info('Metadata refreshed', ['item_id' => $itemId, 'external_id' => $externalId]);
        return true;
    }

    public function refreshLibraryMetadata(string $libraryId, callable $progressCallback = null): int
    {
        $items = $this->db->query(
            "SELECT id, name, metadata_json FROM media_items WHERE library_id = ?",
            [$libraryId]
        );

        $refreshed = 0;
        $total = count($items);

        foreach ($items as $index => $item) {
            if ($this->refreshItemMetadata($item['id'])) {
                $refreshed++;
            }

            if ($progressCallback) {
                $progressCallback($index + 1, $total);
            }
        }

        return $refreshed;
    }

    private function getProviderType(string $mediaType): string
    {
        return match($mediaType) {
            'movie' => 'tmdb',
            'series' => 'tvdb',
            default => 'local',
        };
    }

    private function parseMetadataJson(?string $json): array
    {
        if (empty($json)) {
            return [];
        }
        $data = json_decode($json, true);
        return is_array($data) ? $data : [];
    }
}