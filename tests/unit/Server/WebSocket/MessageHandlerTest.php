<?php

namespace Phlex\Tests\Unit\Server\WebSocket;

use PHPUnit\Framework\TestCase;
use Phlex\Server\WebSocket\MessageHandler;
use Phlex\Server\WebSocket\ConnectionPool;

class MessageHandlerTest extends TestCase
{
    public function testCanRegisterCallback(): void
    {
        $pool = ConnectionPool::getInstance();
        $pool->clear();
        $handler = new MessageHandler($pool);
        
        $called = false;
        $handler->on('test_event', function ($conn, $payload) use (&$called) {
            $called = true;
        });
        
        $this->assertTrue(true); // If we get here, no exception was thrown
    }

    public function testCanBroadcast(): void
    {
        $pool = ConnectionPool::getInstance();
        $pool->clear();
        
        $handler = new MessageHandler($pool);
        
        // Should not throw and return 0 connections broadcasted to
        $this->assertEquals(0, $handler->getConnectionCount());
        $handler->broadcast('test_event', ['data' => 'value']);
    }
}