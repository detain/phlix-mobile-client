<?php

namespace Phlex\Media\Metadata;

interface MetadataProviderInterface
{
    public function search(string $query, array $options = []): array;
    public function getDetails(string $externalId, array $options = []): array;
    public function getImages(string $externalId): array;
    public function getProviders(): array;
}