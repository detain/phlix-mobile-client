<?php

namespace Phlex\Server\WebSocket;

class MessageHandler
{
    private array $callbacks = [];
    private ConnectionPool $connections;

    public function __construct(ConnectionPool $connections)
    {
        $this->connections = $connections;
    }

    public function on(string $event, callable $callback): void
    {
        $this->callbacks[$event] = $callback;
    }

    public function onAny(callable $callback): void
    {
        $this->callbacks['*'] = $callback;
    }

    public function handle(Connection $connection, string $data): void
    {
        $message = json_decode($data, true);
        
        if (!$message || !isset($message['type'])) {
            $connection->sendMessage('error', ['message' => 'Invalid message format']);
            return;
        }

        $event = $message['type'];
        $payload = $message['data'] ?? [];
        
        $this->connections->add($connection);

        // Call specific event handler
        if (isset($this->callbacks[$event])) {
            try {
                ($this->callbacks[$event])($connection, $payload);
            } catch (\Throwable $e) {
                $connection->sendMessage('error', [
                    'message' => 'Handler error: ' . $e->getMessage(),
                ]);
            }
        } elseif (isset($this->callbacks['*'])) {
            // Wildcard handler
            ($this->callbacks['*'])($connection, $event, $payload);
        }
    }

    public function broadcast(string $event, array $data, array $excludeIds = []): void
    {
        $message = json_encode([
            'type' => $event,
            'data' => $data,
            'timestamp' => time(),
        ]);

        foreach ($this->connections->all() as $connection) {
            if (!in_array($connection->getId(), $excludeIds)) {
                $connection->send($message);
            }
        }
    }

    public function sendToUser(string $userId, string $event, array $data): void
    {
        $message = json_encode([
            'type' => $event,
            'data' => $data,
            'timestamp' => time(),
        ]);

        foreach ($this->connections->all() as $connection) {
            if ($connection->getUserId() === $userId) {
                $connection->send($message);
            }
        }
    }

    public function sendToSession(string $sessionId, string $event, array $data): void
    {
        $message = json_encode([
            'type' => $event,
            'data' => $data,
            'timestamp' => time(),
        ]);

        foreach ($this->connections->all() as $connection) {
            if ($connection->getSessionId() === $sessionId) {
                $connection->send($message);
            }
        }
    }

    public function getConnectionCount(): int
    {
        return $this->connections->count();
    }

    public function getAuthenticatedCount(): int
    {
        $count = 0;
        foreach ($this->connections->all() as $connection) {
            if ($connection->isAuthenticated()) {
                $count++;
            }
        }
        return $count;
    }
}