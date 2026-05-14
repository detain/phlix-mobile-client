<?php

namespace Phlex\Server\WebSocket;

use Workerman\Worker;
use Workerman\Connection\TcpConnection;
use Phlex\Common\Logger\LoggerFactory;
use Phlex\Common\Logger\LogChannels;

class WebSocketServer
{
    private Worker $worker;
    private MessageHandler $handler;
    private ConnectionPool $connections;
    private array $config;

    public function __construct(array $config)
    {
        $this->config = $config;
        $this->connections = ConnectionPool::getInstance();
        $this->handler = new MessageHandler($this->connections);
        
        $host = $config['host'] ?? '0.0.0.0';
        $port = $config['port'] ?? 8097;
        
        $this->worker = new Worker("websocket://{$host}:{$port}");
        $this->worker->onWorkerStart = [$this, 'onStart'];
        $this->worker->onConnect = [$this, 'onConnect'];
        $this->worker->onMessage = [$this, 'onMessage'];
        $this->worker->onClose = [$this, 'onClose'];
        $this->worker->onError = [$this, 'onError'];
    }

    public function onStart(): void
    {
        $logger = LoggerFactory::get(LogChannels::WEBSOCKET);
        $logger->info('WebSocket server started', [
            'host' => $this->config['host'] ?? '0.0.0.0',
            'port' => $this->config['port'] ?? 8097,
        ]);

        // Start cleanup timer for stale connections
        if (function_exists('Workerman\Timer')) {
            \Workerman\Timer::add(60, function () {
                $this->connections->cleanupStaleConnections(300);
            });
        }
    }

    public function onConnect(TcpConnection $connection): void
    {
        $wsConnection = new Connection($connection);
        $this->connections->add($wsConnection);
        
        $logger = LoggerFactory::get(LogChannels::WEBSOCKET);
        $logger->debug('New WebSocket connection', [
            'connection_id' => $wsConnection->getId(),
        ]);

        // Send welcome message
        $wsConnection->sendMessage('connected', [
            'connection_id' => $wsConnection->getId(),
            'timestamp' => time(),
        ]);
    }

    public function onMessage(TcpConnection $connection, string $data): void
    {
        $wsConnection = $this->findConnection($connection);
        
        if (!$wsConnection) {
            return;
        }

        $this->handler->handle($wsConnection, $data);
    }

    public function onClose(TcpConnection $connection): void
    {
        $wsConnection = $this->findConnection($connection);
        
        if ($wsConnection) {
            $logger = LoggerFactory::get(LogChannels::WEBSOCKET);
            $logger->info('WebSocket connection closed', [
                'connection_id' => $wsConnection->getId(),
                'user_id' => $wsConnection->getUserId(),
                'authenticated' => $wsConnection->isAuthenticated(),
            ]);

            $this->connections->remove($wsConnection->getId());
            
            // Broadcast disconnection if authenticated
            if ($wsConnection->isAuthenticated()) {
                $this->handler->broadcast('client_disconnected', [
                    'connection_id' => $wsConnection->getId(),
                    'user_id' => $wsConnection->getUserId(),
                ], [$wsConnection->getId()]);
            }
        }
    }

    public function onError(TcpConnection $connection, int $code, string $reason): void
    {
        $logger = LoggerFactory::get(LogChannels::WEBSOCKET);
        $logger->error('WebSocket error', [
            'code' => $code,
            'reason' => $reason,
        ]);
    }

    private function findConnection(TcpConnection $connection): ?Connection
    {
        $objectId = spl_object_id($connection);
        foreach ($this->connections->all() as $wsConnection) {
            if (spl_object_id($wsConnection->getConnection()) === $objectId) {
                return $wsConnection;
            }
        }
        return null;
    }

    public function getHandler(): MessageHandler
    {
        return $this->handler;
    }

    public function run(): void
    {
        Worker::runAll();
    }
}