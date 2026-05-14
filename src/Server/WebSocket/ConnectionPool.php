<?php

namespace Phlex\Server\WebSocket;

class ConnectionPool
{
    private static ConnectionPool $instance;
    private array $connections = [];

    public static function getInstance(): ConnectionPool
    {
        if (!isset(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function add(ConnectionInterface $connection): void
    {
        $this->connections[$connection->getId()] = $connection;
    }

    public function remove(string $id): void
    {
        unset($this->connections[$id]);
    }

    public function get(string $id): ?ConnectionInterface
    {
        return $this->connections[$id] ?? null;
    }

    public function all(): array
    {
        return array_values($this->connections);
    }

    public function count(): int
    {
        return count($this->connections);
    }

    public function findByUserId(string $userId): array
    {
        $found = [];
        foreach ($this->connections as $connection) {
            if ($connection->getUserId() === $userId) {
                $found[] = $connection;
            }
        }
        return $found;
    }

    public function findBySessionId(string $sessionId): array
    {
        $found = [];
        foreach ($this->connections as $connection) {
            if ($connection->getSessionId() === $sessionId) {
                $found[] = $connection;
            }
        }
        return $found;
    }

    public function cleanupStaleConnections(int $maxIdleTime = 300): void
    {
        $now = time();
        foreach ($this->connections as $id => $connection) {
            if ($now - $connection->getLastActivity() > $maxIdleTime) {
                $connection->sendMessage('timeout', ['message' => 'Connection timed out']);
                $connection->close();
                $this->remove($id);
            }
        }
    }

    public function clear(): void
    {
        $this->connections = [];
    }
}