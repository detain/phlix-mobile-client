<?php

/**
 * Web Portal Entry Point
 *
 * This is the main entry point for the Phlex Web Portal. It handles:
 * - Initialization of database connection and logger
 * - Request parsing and authentication
 * - Routing to either API endpoints or HTML page renderers
 *
 * @author Phlex Team
 * @version 1.0.0
 * @description Web portal entry point with request routing
 *
 * @see PageRenderer For HTML page rendering
 * @see WebPortalRouter For API routing
 */

declare(strict_types=1);

// Load Composer autoloader
require_once __DIR__ . '/../vendor/autoload.php';

use Phlex\Server\Core\Application;
use Phlex\Server\Http\Request;
use Phlex\Common\Database\ConnectionPool;
use Phlex\Common\Logger\LoggerFactory;
use Phlex\Auth\AuthManager;
use Phlex\Auth\JwtHandler;
use Phlex\Auth\UserRepository;
use Phlex\Media\Library\LibraryManager;
use Phlex\Media\Library\ItemRepository;
use Phlex\Session\SessionManager;
use Phlex\Session\PlaybackController;
use Phlex\Server\WebPortal\PageRenderer;

/**
 * Initialize configuration paths
 *
 * Configuration files are loaded from the config directory.
 * All paths are absolute to ensure consistent behavior.
 */
$configPath = __DIR__ . '/../config/server.php';
$dbConfigPath = __DIR__ . '/../config/database.php';
$loggerConfigPath = __DIR__ . '/../config/logger.php';

/**
 * Initialize core services
 *
 * ConnectionPool provides database connections
 * LoggerFactory provides application logging
 */
ConnectionPool::init($dbConfigPath);
LoggerFactory::init($loggerConfigPath);

/**
 * Create database connection
 *
 * Uses the default MySQL connection from ConnectionPool.
 *
 * @var \Phlex\Common\Database\Connection $db
 */
$db = ConnectionPool::getConnection('mysql');

/**
 * Initialize authentication components
 *
 * JwtHandler creates and validates JWT tokens
 * UserRepository provides user data access
 * AuthManager orchestrates authentication workflows
 */
$jwtHandler = new JwtHandler(getenv('JWT_SECRET') ?: 'default-secret-change-me');
$userRepository = new UserRepository($db);
$authManager = new AuthManager(
    $userRepository,
    $jwtHandler,
    LoggerFactory::get(\Phlex\Common\Logger\LogChannels::AUTH)
);

/**
 * Initialize library and media components
 */
$itemRepository = new ItemRepository($db);
$libraryManager = new LibraryManager($db, $scanner ?? null, $watcher ?? null);

/**
 * Initialize session and playback components
 */
$sessionManager = new SessionManager($db);
$playbackController = new PlaybackController($db, $sessionManager);

/**
 * Create request from global PHP variables
 *
 * Request::fromGlobals() parses HTTP request data including:
 * - HTTP method and path
 * - Query parameters
 * - Headers (including Authorization)
 * - Body content
 */
$request = Request::fromGlobals();

/**
 * Authenticate request if token provided
 *
 * Checks for Bearer token in Authorization header.
 * If valid, sets userId on request for downstream handlers.
 */
$token = $request->getBearerToken();
if ($token) {
    $auth = $authManager->validateAccessToken($token);
    if ($auth) {
        $request->userId = $auth['user_id'];
    }
}

/**
 * Route handling
 *
 * Routes are split into two categories:
 * - API routes (prefixed with /api/) - Return JSON
 * - Page routes - Return HTML rendered by Smarty
 */
$path = $request->path;

if (str_starts_with($path, '/api/')) {
    /**
     * API routes
     *
     * API endpoints are handled by WebPortalRouter and return JSON.
     * This implementation currently returns a placeholder message.
     * Full API implementation is in WebPortalRouter.
     *
     * @see WebPortalRouter For complete API handling
     */
    header('Content-Type: application/json');
    echo json_encode(['message' => 'API endpoint - implement in Step 5.2']);
} else {
    /**
     * Page routes
     *
     * HTML pages are rendered using Smarty templates via PageRenderer.
     * Supported routes:
     * - / or '' : Home page
     * - /login : Login page
     * - /library/{id} : Library browser (via PageRenderer::renderLibrary)
     * - Other : 404 Not Found
     *
     * @see PageRenderer For page rendering
     */
    $renderer = new PageRenderer(
        __DIR__ . '/templates',
        $libraryManager,
        $itemRepository,
        $playbackController
    );

    if ($path === '/' || $path === '') {
        /** @var Response Home page */
        $response = $renderer->renderHome($request);
    } elseif ($path === '/login') {
        /** @var Response Login page */
        $response = $renderer->renderLogin($request);
    } else {
        /** @var int 404 Not Found status code */
        http_response_code(404);
        echo '<h1>404 - Page not found</h1>';
        exit;
    }

    /** @var Response Send the HTTP response */
    $response->send();
}