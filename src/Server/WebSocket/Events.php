<?php

namespace Phlex\Server\WebSocket;

/**
 * WebSocket event type constants.
 */
final class WebSocketEvents
{
    // Connection events
    public const CONNECTED = 'connected';
    public const DISCONNECTED = 'disconnected';
    public const CLIENT_DISCONNECTED = 'client_disconnected';
    
    // Authentication events
    public const AUTH_REQUEST = 'auth_request';
    public const AUTH_SUCCESS = 'auth_success';
    public const AUTH_FAILURE = 'auth_failure';
    
    // Session events
    public const SESSION_START = 'session_start';
    public const SESSION_END = 'session_end';
    public const SESSION_JOIN = 'session_join';
    public const SESSION_LEAVE = 'session_leave';
    
    // Playback events
    public const PLAYBACK_START = 'playback_start';
    public const PLAYBACK_PAUSE = 'playback_pause';
    public const PLAYBACK_STOP = 'playback_stop';
    public const PLAYBACK_PROGRESS = 'playback_progress';
    public const PLAYBACK_SEEK = 'playback_seek';
    
    // SyncPlay events
    public const SYNCPLAY_CREATE_GROUP = 'syncplay_create_group';
    public const SYNCPLAY_JOIN_GROUP = 'syncplay_join_group';
    public const SYNCPLAY_LEAVE_GROUP = 'syncplay_leave_group';
    public const SYNCPLAY_SYNC_STATE = 'syncplay_sync_state';
    public const SYNCPLAY_SYNC_REQUEST = 'syncplay_sync_request';
    
    // General events
    public const ERROR = 'error';
    public const PING = 'ping';
    public const PONG = 'pong';
    public const NOTIFICATION = 'notification';
    public const LIBRARY_UPDATED = 'library_updated';

    private function __construct()
    {
        // Prevent instantiation
    }
}