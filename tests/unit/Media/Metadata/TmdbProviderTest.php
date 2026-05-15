<?php

namespace Phlex\Tests\Unit\Media\Metadata;

use PHPUnit\Framework\TestCase;
use Phlex\Media\Metadata\TmdbProvider;
use Phlex\Common\Logger\LoggerFactory;

class TmdbProviderTest extends TestCase
{
    protected function setUp(): void
    {
        LoggerFactory::init(__DIR__ . '/../../../../config/logger.php');
    }

    public function testCanCreateTmdbProvider(): void
    {
        // Use a mock or test API key
        $provider = new TmdbProvider('test-api-key');
        $this->assertInstanceOf(TmdbProvider::class, $provider);
    }

    public function testGetProvidersReturnsTmdb(): void
    {
        $provider = new TmdbProvider('test-api-key');
        $providers = $provider->getProviders();
        
        $this->assertContains('tmdb', $providers);
    }
}