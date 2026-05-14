<?php

namespace Phlex\Server\WebSocket;

/**
 * Interface for WebSocket connections.
 */
interface ConnectionInterface
{
    public function getId(): string;
    public function send(string|array $data): void;
    public function sendMessage(string $type, array $data = []): void;
    public function close(): void;
    public function updateActivity(): void;
    public function getLastActivity(): int;
    public function isAuthenticated(): bool;
    public function setAuthenticated(bool $authenticated, ?string $userId = null): void;
    public function getUserId(): ?string;
    public function setSessionId(?string $sessionId): void;
    public function getSessionId(): ?string;
    public function set(string $key, mixed $value): void;
    public function get(string $key, mixed $default = null): mixed;
    public function has(string $key): bool;
    public function remove(string $key): void;
    public function getAll(): array;
}