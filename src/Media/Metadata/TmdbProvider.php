<?php

namespace Phlex\Media\Metadata;

class TmdbProvider implements MetadataProviderInterface
{
    private MetadataHttpClient $http;
    private string $imageBaseUrl;
    private array $cache = [];

    public function __construct(string $apiKey)
    {
        $this->http = new MetadataHttpClient(
            'https://api.themoviedb.org/3',
            $apiKey
        );
        $this->imageBaseUrl = 'https://image.tmdb.org/t/p';
    }

    public function search(string $query, array $options = []): array
    {
        $language = $options['language'] ?? 'en-US';
        $includeAdult = $options['include_adult'] ?? false;

        $params = [
            'query' => $query,
            'language' => $language,
            'include_adult' => $includeAdult,
        ];

        $response = $this->http->get('/search/movie', $params);

        if (!$response || !isset($response['results'])) {
            return [];
        }

        return array_map(function ($result) {
            return [
                'id' => $result['id'],
                'title' => $result['title'] ?? $result['name'] ?? '',
                'original_title' => $result['original_title'] ?? '',
                'overview' => $result['overview'] ?? '',
                'poster_path' => $result['poster_path'] ?? null,
                'backdrop_path' => $result['backdrop_path'] ?? null,
                'release_date' => $result['release_date'] ?? '',
                'vote_average' => $result['vote_average'] ?? 0,
                'vote_count' => $result['vote_count'] ?? 0,
            ];
        }, $response['results']);
    }

    public function getDetails(string $externalId, array $options = []): array
    {
        $language = $options['language'] ?? 'en-US';
        
        $response = $this->http->get("/movie/{$externalId}", [
            'language' => $language,
            'append_to_response' => 'credits,genres,production_companies',
        ]);

        if (!$response) {
            return [];
        }

        return $this->formatMovieDetails($response);
    }

    public function getImages(string $externalId): array
    {
        $response = $this->http->get("/movie/{$externalId}/images");

        if (!$response) {
            return [];
        }

        return [
            'posters' => $this->formatImages($response['posters'] ?? []),
            'backdrops' => $this->formatImages($response['backdrops'] ?? []),
            'logos' => $this->formatImages($response['logos'] ?? []),
        ];
    }

    public function getProviders(): array
    {
        return ['tmdb'];
    }

    private function formatMovieDetails(array $data): array
    {
        return [
            'name' => $data['title'] ?? $data['name'] ?? '',
            'original_name' => $data['original_title'] ?? $data['original_name'] ?? '',
            'overview' => $data['overview'] ?? '',
            'official_rating' => null,
            'vote_average' => $data['vote_average'] ?? 0,
            'vote_count' => $data['vote_count'] ?? 0,
            'year' => isset($data['release_date']) ? date('Y', strtotime($data['release_date'])) : null,
            'runtime_ticks' => ($data['runtime'] ?? 0) * 600000000, // Convert minutes to ticks
            'genres' => array_map(fn($g) => $g['name'], $data['genres'] ?? []),
            'studio' => $data['production_companies'][0]['name'] ?? null,
            'tagline' => $data['tagline'] ?? '',
            'budget' => $data['budget'] ?? 0,
            'revenue' => $data['revenue'] ?? 0,
            'imdb_id' => $data['imdb_id'] ?? null,
            'tmdb_id' => $data['id'] ?? null,
            'actors' => array_map(fn($c) => [
                'name' => $c['name'] ?? '',
                'role' => $c['character'] ?? '',
                'order' => $c['order'] ?? 0,
            ], array_slice($data['credits']['cast'] ?? [], 0, 20)),
            'director' => $this->findDirector($data['credits']['crew'] ?? []),
        ];
    }

    private function findDirector(array $crew): ?string
    {
        foreach ($crew as $member) {
            if (($member['job'] ?? '') === 'Director') {
                return $member['name'] ?? null;
            }
        }
        return null;
    }

    private function formatImages(array $images): array
    {
        return array_map(function ($image) {
            return [
                'url' => $this->imageBaseUrl . '/w500' . $image['file_path'],
                'url_original' => $this->imageBaseUrl . '/original' . $image['file_path'],
                'width' => $image['width'] ?? 0,
                'height' => $image['height'] ?? 0,
                'language' => $image['iso_639_1'] ?? null,
            ];
        }, $images);
    }
}