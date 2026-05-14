<?php

namespace Phlex\Server\WebSocket;

use Workerman\Connection\TcpConnection;

class Connection implements ConnectionInterface
{
    private TcpConnection $connection;
    private string $id;
    private array $sessionData = [];
    private bool $authenticated = false;
    private ?string $userId = null;
    private ?string $sessionId = null;
    private int $lastActivity;

    public function __construct(TcpConnection $connection)
    {
        $this->connection = $connection;
        $this->id = spl_object_id($connection) . '-' . uniqid();
        $this->lastActivity = time();
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function send(string|array $data): void
    {
        if (is_array($data)) {
            $data = json_encode($data);
        }
        $this->connection->send($data);
        $this->updateActivity();
    }

    public function sendMessage(string $type, array $data = []): void
    {
        $this->send([
            'type' => $type,
            'data' => $data,
            'timestamp' => time(),
        ]);
    }

    public function close(): void
    {
        $this->connection->close();
    }

    public function updateActivity(): void
    {
        $this->lastActivity = time();
    }

    public function getLastActivity(): int
    {
        return $this->lastActivity;
    }

    public function isAuthenticated(): bool
    {
        return $this->authenticated;
    }

    public function setAuthenticated(bool $authenticated, ?string $userId = null): void
    {
        $this->authenticated = $authenticated;
        $this->userId = $userId;
    }

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function setSessionId(?string $sessionId): void
    {
        $this->sessionId = $sessionId;
    }

    public function getSessionId(): ?string
    {
        return $this->sessionId;
    }

    public function set(string $key, mixed $value): void
    {
        $this->sessionData[$key] = $value;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->sessionData[$key] ?? $default;
    }

    public function has(string $key): bool
    {
        return isset($this->sessionData[$key]);
    }

    public function remove(string $key): void
    {
        unset($this->sessionData[$key]);
    }

    public function getAll(): array
    {
        return $this->sessionData;
    }

    public function getConnection(): TcpConnection
    {
        return $this->connection;
    }
}