<?php
/**
 * MRRlytics - WHMCS Data Extraction Addon
 * 
 * Exposes a secure endpoint to export billing and service data
 * in JSON format to external analytics platforms.
 * 
 * @package    MRRlytics
 * @author     MRRlytics Team
 * @version    1.1.0
 * @license    MIT
 * 
 * @requires   PHP 7.2+
 * @requires   WHMCS 8.0+
 */

if (!defined('WHMCS')) {
    die('This file cannot be accessed directly.');
}

use Illuminate\Database\Capsule\Manager as Capsule;

define('MRRLYTICS_VERSION', '1.3.3');
define('MRRLYTICS_VERSION_CHECK_URL', 'https://app.mrrlytics.com/api/module/version');

/**
 * Generate a secure random API key
 * 
 * @return string 64-character hex string
 */
function mrrlytics_generateApiKey()
{
    if (function_exists('random_bytes')) {
        return bin2hex(random_bytes(32));
    }
    // Fallback for older PHP versions
    return bin2hex(openssl_random_pseudo_bytes(32));
}

/**
 * Get or create API key
 * 
 * @return string
 */
function mrrlytics_getOrCreateApiKey()
{
    $existingKey = Capsule::table('tbladdonmodules')
        ->where('module', 'mrrlytics')
        ->where('setting', 'API_KEY')
        ->value('value');
    
    if (!empty($existingKey)) {
        return $existingKey;
    }
    
    // Generate new key
    $newKey = mrrlytics_generateApiKey();
    
    // Save it
    Capsule::table('tbladdonmodules')->updateOrInsert(
        ['module' => 'mrrlytics', 'setting' => 'API_KEY'],
        ['value' => $newKey]
    );
    
    return $newKey;
}

/**
 * Handle regenerate API key request
 */
if (isset($_GET['mrrlytics_regenerate']) && $_GET['mrrlytics_regenerate'] == '1') {
    try {
        $newKey = mrrlytics_generateApiKey();
        Capsule::table('tbladdonmodules')->updateOrInsert(
            ['module' => 'mrrlytics', 'setting' => 'API_KEY'],
            ['value' => $newKey]
        );
        // Redirect back to config page
        header('Location: configaddonmods.php?module=mrrlytics&regenerated=1');
        exit;
    } catch (\Exception $e) {
        // Continue to config page
    }
}

/**
 * Handle export request
 */
if (isset($_GET['mrrlytics_export']) && $_GET['mrrlytics_export'] == '1') {
    try {
        require_once __DIR__ . '/export.php';
        $exporter = new MRRlyticsExporter();
        $result = $exporter->run();
        
        if ($result['success']) {
            header('Location: configaddonmods.php?module=mrrlytics&exported=1&file=' . urlencode($result['filename']));
        } else {
            header('Location: configaddonmods.php?module=mrrlytics&export_error=' . urlencode($result['error']));
        }
        exit;
    } catch (\Exception $e) {
        header('Location: configaddonmods.php?module=mrrlytics&export_error=' . urlencode($e->getMessage()));
        exit;
    }
}

/**
 * Handle download request
 */
if (isset($_GET['mrrlytics_download'])) {
    $filename = $_GET['mrrlytics_download'];
    require_once __DIR__ . '/export.php';
    $exporter = new MRRlyticsExporter();
    $filepath = $exporter->getExportPath($filename);
    
    if ($filepath) {
        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="' . basename($filepath) . '"');
        header('Content-Length: ' . filesize($filepath));
        readfile($filepath);
        exit;
    }
}

/**
 * Handle delete export request
 */
if (isset($_GET['mrrlytics_delete'])) {
    $filename = $_GET['mrrlytics_delete'];
    require_once __DIR__ . '/export.php';
    $exporter = new MRRlyticsExporter();
    $exporter->deleteExport($filename);
    header('Location: configaddonmods.php?module=mrrlytics&deleted=1');
    exit;
}

/**
 * Check for a newer module version (cached for 24 hours in tbladdonmodules)
 *
 * @return array{update_available: bool, latest_version: string, release_notes: string, download_url: string}
 */
function mrrlytics_checkForUpdate()
{
    $noUpdate = [
        'update_available' => false,
        'latest_version'   => MRRLYTICS_VERSION,
        'release_notes'    => '',
        'download_url'     => '',
    ];

    try {
        // Read cached data from DB
        $cachedJson = Capsule::table('tbladdonmodules')
            ->where('module', 'mrrlytics')
            ->where('setting', 'version_check_cache')
            ->value('value');

        $cache = $cachedJson ? json_decode($cachedJson, true) : null;

        // Use cache if it's less than 24 hours old
        if (
            $cache &&
            isset($cache['checked_at']) &&
            (time() - (int) $cache['checked_at']) < 86400
        ) {
            $latestVersion = $cache['latest_version'] ?? MRRLYTICS_VERSION;
            return [
                'update_available' => version_compare(MRRLYTICS_VERSION, $latestVersion, '<'),
                'latest_version'   => $latestVersion,
                'release_notes'    => $cache['release_notes'] ?? '',
                'download_url'     => $cache['download_url'] ?? '',
            ];
        }

        // Fetch from remote
        $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
        $response = @file_get_contents(MRRLYTICS_VERSION_CHECK_URL, false, $ctx);

        if ($response === false) {
            return $noUpdate;
        }

        $data = json_decode($response, true);
        if (!$data || !isset($data['version'])) {
            return $noUpdate;
        }

        // Store in cache
        Capsule::table('tbladdonmodules')->updateOrInsert(
            ['module' => 'mrrlytics', 'setting' => 'version_check_cache'],
            ['value' => json_encode([
                'checked_at'     => time(),
                'latest_version' => $data['version'],
                'release_notes'  => $data['release_notes'] ?? '',
                'download_url'   => $data['download_url'] ?? '',
            ])]
        );

        return [
            'update_available' => version_compare(MRRLYTICS_VERSION, $data['version'], '<'),
            'latest_version'   => $data['version'],
            'release_notes'    => $data['release_notes'] ?? '',
            'download_url'     => $data['download_url'] ?? '',
        ];
    } catch (\Exception $e) {
        return $noUpdate;
    }
}

/**
 * Auto-update the module by downloading and extracting the latest ZIP.
 *
 * @param  string $downloadUrl  Trusted URL returned by mrrlytics_checkForUpdate()
 * @return array{success: bool, message: string}
 */
function mrrlytics_autoUpdate($downloadUrl)
{
    // 1. Validate URL is from trusted source (Supabase storage only)
    if (!preg_match('#^https://[a-z0-9]+\.supabase\.co/#', $downloadUrl)) {
        return ['success' => false, 'message' => 'Untrusted download URL.'];
    }

    $moduleDir = __DIR__;
    if (!is_writable($moduleDir)) {
        return ['success' => false, 'message' => 'Module directory is not writable by the web server.'];
    }

    // 2. Download ZIP to a temp file
    $tempZip = tempnam(sys_get_temp_dir(), 'mrrlytics_upd_') . '.zip';
    $ctx = stream_context_create(['http' => ['timeout' => 30, 'ignore_errors' => true]]);
    $zipContent = @file_get_contents($downloadUrl, false, $ctx);
    if ($zipContent === false || strlen($zipContent) < 1000) {
        return ['success' => false, 'message' => 'Failed to download update package. Check server outbound connectivity.'];
    }
    file_put_contents($tempZip, $zipContent);

    // 3. Extract ZIP
    if (!class_exists('ZipArchive')) {
        @unlink($tempZip);
        return ['success' => false, 'message' => 'PHP ZipArchive extension is not available on this server.'];
    }
    $zip = new ZipArchive();
    if ($zip->open($tempZip) !== true) {
        @unlink($tempZip);
        return ['success' => false, 'message' => 'Failed to open the downloaded ZIP file.'];
    }
    $tempExtract = sys_get_temp_dir() . '/mrrlytics_upd_' . time();
    mkdir($tempExtract, 0755, true);
    $zip->extractTo($tempExtract);
    $zip->close();
    @unlink($tempZip);

    // 4. Find the module root inside the ZIP (may be wrapped in a single subfolder)
    $sourceDir = $tempExtract;
    $entries = array_diff(scandir($tempExtract), ['.', '..']);
    if (count($entries) === 1) {
        $only = reset($entries);
        if (is_dir($tempExtract . '/' . $only)) {
            $sourceDir = $tempExtract . '/' . $only;
        }
    }

    // 5. Validate extracted content contains expected entry point
    if (!file_exists($sourceDir . '/mrrlytics.php')) {
        mrrlytics_rmdirRecursive($tempExtract);
        return ['success' => false, 'message' => 'Invalid update package — mrrlytics.php not found inside ZIP.'];
    }

    // 6. Copy new files over the current module directory
    mrrlytics_copyRecursive($sourceDir, $moduleDir);

    // 7. Cleanup temp directory
    mrrlytics_rmdirRecursive($tempExtract);

    // 8. Clear version check cache so the banner re-checks on next page load
    try {
        Capsule::table('tbladdonmodules')
            ->where('module', 'mrrlytics')
            ->where('setting', 'version_check_cache')
            ->delete();
    } catch (\Exception $e) {
        // Non-fatal — cache will expire naturally
    }

    return ['success' => true, 'message' => 'Module updated successfully. Reloading…'];
}

/**
 * Recursively copy a directory tree from $src to $dst.
 */
function mrrlytics_copyRecursive($src, $dst)
{
    $dir = opendir($src);
    while (($file = readdir($dir)) !== false) {
        if ($file === '.' || $file === '..') {
            continue;
        }
        $srcPath = $src . '/' . $file;
        $dstPath = $dst . '/' . $file;
        if (is_dir($srcPath)) {
            if (!is_dir($dstPath)) {
                mkdir($dstPath, 0755, true);
            }
            mrrlytics_copyRecursive($srcPath, $dstPath);
        } else {
            copy($srcPath, $dstPath);
        }
    }
    closedir($dir);
}

/**
 * Recursively delete a directory and all its contents.
 */
function mrrlytics_rmdirRecursive($dir)
{
    foreach (array_diff(scandir($dir), ['.', '..']) as $file) {
        $path = $dir . '/' . $file;
        is_dir($path) ? mrrlytics_rmdirRecursive($path) : unlink($path);
    }
    rmdir($dir);
}

/**
 * Addon configuration
 *
 * Defines the addon metadata and configuration fields.
 *
 * @return array
 */
function mrrlytics_config()
{
    // Get current API Key from database to display
    $currentApiKey = '';
    try {
        $currentApiKey = Capsule::table('tbladdonmodules')
            ->where('module', 'mrrlytics')
            ->where('setting', 'API_KEY')
            ->value('value');
    } catch (\Exception $e) {
        $currentApiKey = '';
    }
    
    // Check messages
    $messages = '';
    if (isset($_GET['regenerated']) && $_GET['regenerated'] == '1') {
        $messages .= '<div style="color: green; margin-bottom: 8px;">API Key regenerated successfully!</div>';
    }
    if (isset($_GET['exported']) && $_GET['exported'] == '1') {
        $filename = isset($_GET['file']) ? htmlspecialchars($_GET['file']) : '';
        $messages .= '<div style="color: green; margin-bottom: 8px;">Export created: ' . $filename . '</div>';
    }
    if (isset($_GET['export_error'])) {
        $messages .= '<div style="color: red; margin-bottom: 8px;">Export error: ' . htmlspecialchars($_GET['export_error']) . '</div>';
    }
    if (isset($_GET['deleted']) && $_GET['deleted'] == '1') {
        $messages .= '<div style="color: green; margin-bottom: 8px;">Export file deleted.</div>';
    }
    
    // Build API Key display HTML
    $apiKeyHtml = '';
    if (!empty($currentApiKey)) {
        $apiKeyHtml = $messages . '
            <input type="text" id="mrrlytics_apikey_display" value="' . htmlspecialchars($currentApiKey) . '" 
                   readonly style="font-family: monospace; width: 450px; padding: 6px;">
            <button type="button" onclick="
                var input = document.getElementById(\'mrrlytics_apikey_display\');
                input.select();
                document.execCommand(\'copy\');
                alert(\'Copied!\');
            " style="padding: 6px 12px; margin-left: 5px; cursor: pointer;">Copy</button>
            <button type="button" onclick="
                if(confirm(\'Regenerate API Key? The current key will stop working.\')) {
                    window.location.href = \'configaddonmods.php?module=mrrlytics&mrrlytics_regenerate=1\';
                }
            " style="padding: 6px 12px; margin-left: 5px; cursor: pointer;">Regenerate</button>
        ';
    } else {
        $apiKeyHtml = $messages . '<span style="color: #d9534f;">Will be auto-generated on activation.</span>';
    }
    
    // Build Export section HTML
    $exportHtml = '';
    
    // List existing exports
    require_once __DIR__ . '/export.php';
    $exporter = new MRRlyticsExporter();
    $exports = $exporter->listExports();
    
    $exportHtml .= '<button type="button" onclick="
        if(confirm(\'Generate a new JSON export? This may take a few minutes for large databases.\')) {
            window.location.href = \'configaddonmods.php?module=mrrlytics&mrrlytics_export=1\';
        }
    " style="padding: 8px 16px; cursor: pointer; background: #5cb85c; color: white; border: none; border-radius: 4px;">Generate Export</button>';
    
    if (!empty($exports)) {
        $exportHtml .= '<div style="margin-top: 15px;"><strong>Available exports:</strong></div>';
        $exportHtml .= '<table style="margin-top: 10px; border-collapse: collapse; width: 100%;">';
        $exportHtml .= '<tr style="background: #f5f5f5;"><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">File</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Size</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Created</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Actions</th></tr>';
        
        foreach ($exports as $export) {
            $exportHtml .= '<tr>';
            $exportHtml .= '<td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">' . htmlspecialchars($export['filename']) . '</td>';
            $exportHtml .= '<td style="padding: 8px; border: 1px solid #ddd;">' . $export['filesize_human'] . '</td>';
            $exportHtml .= '<td style="padding: 8px; border: 1px solid #ddd;">' . $export['created'] . '</td>';
            $exportHtml .= '<td style="padding: 8px; border: 1px solid #ddd;">';
            $exportHtml .= '<a href="configaddonmods.php?module=mrrlytics&mrrlytics_download=' . urlencode($export['filename']) . '" style="margin-right: 10px;">Download</a>';
            $exportHtml .= '<a href="configaddonmods.php?module=mrrlytics&mrrlytics_delete=' . urlencode($export['filename']) . '" onclick="return confirm(\'Delete this export?\');" style="color: red;">Delete</a>';
            $exportHtml .= '</td>';
            $exportHtml .= '</tr>';
        }
        
        $exportHtml .= '</table>';
    } else {
        $exportHtml .= '<p style="margin-top: 10px; color: #666;">No exports generated yet.</p>';
    }
    
    return [
        'name'        => 'MRRlytics',
        'description' => 'Secure endpoint to export billing and service data in JSON format to analytics platforms.',
        'version'     => MRRLYTICS_VERSION,
        'author'      => 'MRRlytics Team',
        'language'    => 'english',
        'fields'      => [
            'API_KEY_DISPLAY' => [
                'FriendlyName' => 'API Key',
                'Type'         => 'info',
                'Description'  => $apiKeyHtml,
            ],
            'EXPORT_SECTION' => [
                'FriendlyName' => 'Data Export',
                'Type'         => 'info',
                'Description'  => $exportHtml,
            ],
            'RATE_LIMIT' => [
                'FriendlyName' => 'Rate Limit',
                'Type'         => 'text',
                'Size'         => 5,
                'Default'      => '300',
                'Description'  => 'Requests per minute per IP.',
            ],
        ],
    ];
}

/**
 * Addon activation
 * 
 * Creates the necessary table for rate limiting and auto-generates API key.
 * 
 * @return array
 */
function mrrlytics_activate()
{
    try {
        // Create rate limiting table if it doesn't exist
        if (!Capsule::schema()->hasTable('mod_mrrlytics_ratelimit')) {
            Capsule::schema()->create('mod_mrrlytics_ratelimit', function ($table) {
                $table->increments('id');
                $table->string('ip_address', 45); // IPv6 compatible
                $table->unsignedInteger('request_time');
                $table->index(['ip_address', 'request_time'], 'idx_ip_time');
            });
        }
        
        // Auto-generate API Key
        $apiKey = mrrlytics_getOrCreateApiKey();
        
        return [
            'status'      => 'success',
            'description' => 'MRRlytics has been activated successfully. API Key has been auto-generated. Go to Addons > MRRlytics to view and copy your API Key.',
        ];
    } catch (\Exception $e) {
        return [
            'status'      => 'error',
            'description' => 'Error activating MRRlytics: ' . $e->getMessage(),
        ];
    }
}

/**
 * Addon deactivation
 * 
 * Removes the rate limiting table.
 * 
 * @return array
 */
function mrrlytics_deactivate()
{
    try {
        // Drop rate limiting table
        Capsule::schema()->dropIfExists('mod_mrrlytics_ratelimit');

        return [
            'status'      => 'success',
            'description' => 'MRRlytics has been deactivated successfully.',
        ];
    } catch (\Exception $e) {
        return [
            'status'      => 'error',
            'description' => 'Error deactivating MRRlytics: ' . $e->getMessage(),
        ];
    }
}

/**
 * Addon upgrade handler
 * 
 * Handles database migrations between versions.
 * 
 * @param array $vars Addon variables including previous version
 * 
 * @return array
 */
function mrrlytics_upgrade($vars)
{
    $currentVersion = isset($vars['version']) ? $vars['version'] : '1.0.0';
    
    // v1.1.0: Auto-generate API key if not set
    if (version_compare($currentVersion, '1.1.0', '<')) {
        try {
            mrrlytics_getOrCreateApiKey();
        } catch (\Exception $e) {
            // Non-critical, continue
        }
    }
    
    return [
        'status'      => 'success',
        'description' => 'MRRlytics upgraded successfully. Go to Addons > MRRlytics to view your API Key.',
    ];
}

/**
 * Addon admin area output
 * 
 * Displays the addon control panel with status and usage information.
 * 
 * @param array $vars Addon variables
 * 
 * @return void
 */
function mrrlytics_output($vars)
{
    // Handle auto-update action
    if (isset($_POST['mrrlytics_action']) && $_POST['mrrlytics_action'] === 'auto_update') {
        if (isset($_POST['token'])) {
            $updateInfo = mrrlytics_checkForUpdate();
            if ($updateInfo['update_available'] && !empty($updateInfo['download_url'])) {
                $result = mrrlytics_autoUpdate($updateInfo['download_url']);
                if ($result['success']) {
                    echo '<div class="alert alert-success"><strong>Updated!</strong> ' . htmlspecialchars($result['message'])
                        . '<script>setTimeout(function(){ location.reload(); }, 2000);</script></div>';
                } else {
                    echo '<div class="alert alert-danger"><strong>Auto-update failed:</strong> ' . htmlspecialchars($result['message']) . '</div>';
                }
            } else {
                echo '<div class="alert alert-info">No update is currently available.</div>';
            }
        }
    }

    // Handle regenerate API key action
    if (isset($_POST['mrrlytics_action']) && $_POST['mrrlytics_action'] === 'regenerate_key') {
        // Verify WHMCS token
        if (isset($_POST['token'])) {
            try {
                $newKey = mrrlytics_generateApiKey();
                Capsule::table('tbladdonmodules')
                    ->where('module', 'mrrlytics')
                    ->where('setting', 'API_KEY')
                    ->update(['value' => $newKey]);
                
                $vars['API_KEY'] = $newKey;
                echo '<div class="alert alert-success"><strong>Success!</strong> API Key has been regenerated. Make sure to update your MRRlytics dashboard configuration.</div>';
            } catch (\Exception $e) {
                echo '<div class="alert alert-danger"><strong>Error!</strong> Failed to regenerate API Key: ' . htmlspecialchars($e->getMessage()) . '</div>';
            }
        }
    }
    
    // Always get API key directly from database (WHMCS doesn't pass password fields in $vars)
    $apiKey = '';
    try {
        $apiKey = Capsule::table('tbladdonmodules')
            ->where('module', 'mrrlytics')
            ->where('setting', 'API_KEY')
            ->value('value');
        
        // Auto-generate if empty (first time accessing panel after upgrade)
        if (empty($apiKey)) {
            $apiKey = mrrlytics_generateApiKey();
            Capsule::table('tbladdonmodules')->updateOrInsert(
                ['module' => 'mrrlytics', 'setting' => 'API_KEY'],
                ['value' => $apiKey]
            );
            echo '<div class="alert alert-info"><strong>Info:</strong> API Key was auto-generated for you.</div>';
        }
    } catch (\Exception $e) {
        $apiKey = '';
    }
    
    $rateLimit = isset($vars['RATE_LIMIT']) ? $vars['RATE_LIMIT'] : '300';

    // Update check banner
    $updateInfo = mrrlytics_checkForUpdate();
    if ($updateInfo['update_available']) {
        $latestEsc   = htmlspecialchars($updateInfo['latest_version']);
        $releaseNotes = !empty($updateInfo['release_notes'])
            ? '<br><small>' . htmlspecialchars($updateInfo['release_notes']) . '</small>'
            : '';

        $downloadLink  = '';
        $autoUpdateBtn = '';
        if (!empty($updateInfo['download_url'])) {
            $downloadLink = '<a href="' . htmlspecialchars($updateInfo['download_url']) . '" target="_blank" class="btn btn-sm btn-default" style="margin-left:4px;">Download ZIP</a>';
            if (is_writable(__DIR__)) {
                $confirmMsg   = addslashes('Auto-update to v' . $updateInfo['latest_version'] . "?\nThis will replace all module files automatically.");
                $autoUpdateBtn = '<form method="post" style="display:inline;margin-left:4px;" onsubmit="return confirm(\'' . $confirmMsg . '\');">'
                    . '<input type="hidden" name="token" value="' . generate_token('link') . '">'
                    . '<input type="hidden" name="mrrlytics_action" value="auto_update">'
                    . '<button type="submit" class="btn btn-sm btn-primary">Auto-update to v' . $latestEsc . '</button>'
                    . '</form>';
            }
        }

        echo '<div class="alert alert-warning" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">';
        echo '<span><strong>Update available:</strong> MRRlytics module v' . $latestEsc . ' is ready. You are running v' . MRRLYTICS_VERSION . '.' . $releaseNotes . '</span>';
        echo '<span>' . $autoUpdateBtn . $downloadLink . '</span>';
        echo '</div>';
    }

    // Get usage statistics
    $stats = mrrlytics_getStats();
    
    // Generate endpoint URL
    $systemUrl = isset($GLOBALS['CONFIG']['SystemURL']) ? $GLOBALS['CONFIG']['SystemURL'] : '';
    $endpointUrl = rtrim($systemUrl, '/') . '/modules/addons/mrrlytics/api.php';
    
    // Get CSRF token
    $token = generate_token('link');
    
    echo '<div class="panel panel-default">';
    echo '<div class="panel-heading"><h3 class="panel-title">MRRlytics - Control Panel</h3></div>';
    echo '<div class="panel-body">';
    
    // API Key Section
    echo '<div class="row">';
    echo '<div class="col-md-12">';
    echo '<h4>API Key</h4>';
    echo '<div class="well">';
    
    if (!empty($apiKey)) {
        echo '<div class="form-group">';
        echo '<label>Current API Key:</label>';
        echo '<div class="input-group">';
        echo '<input type="text" class="form-control" id="mrrlytics-api-key" value="' . htmlspecialchars($apiKey) . '" readonly style="font-family: monospace; font-size: 13px;">';
        echo '<span class="input-group-btn">';
        echo '<button type="button" class="btn btn-success" onclick="mrrlytics_copyApiKey()" title="Copy to clipboard">Copy</button>';
        echo '<button type="button" class="btn btn-default" onclick="mrrlytics_toggleApiKey()" title="Show/Hide" id="mrrlytics-toggle-btn">Hide</button>';
        echo '</span>';
        echo '</div>';
        echo '<p class="help-block" style="margin-top: 5px;">Use this key in the X-MRRlytics-Key header when making API requests.</p>';
        echo '</div>';
        
        // Regenerate form
        echo '<form method="post" style="margin-top: 15px;" onsubmit="return confirm(\'Are you sure you want to regenerate the API Key?\\n\\nThis will invalidate the current key and you will need to update your MRRlytics dashboard configuration.\');">';
        echo '<input type="hidden" name="token" value="' . $token . '">';
        echo '<input type="hidden" name="mrrlytics_action" value="regenerate_key">';
        echo '<button type="submit" class="btn btn-warning">Regenerate API Key</button>';
        echo '</form>';
    } else {
        echo '<div class="alert alert-warning">No API Key configured. Click below to generate one.</div>';
        echo '<form method="post">';
        echo '<input type="hidden" name="token" value="' . $token . '">';
        echo '<input type="hidden" name="mrrlytics_action" value="regenerate_key">';
        echo '<button type="submit" class="btn btn-primary">Generate API Key</button>';
        echo '</form>';
    }
    
    echo '</div>'; // .well
    echo '</div>'; // .col-md-12
    echo '</div>'; // .row
    
    // Configuration status
    echo '<div class="row" style="margin-top: 20px;">';
    echo '<div class="col-md-6">';
    echo '<h4>Configuration Status</h4>';
    echo '<table class="table table-bordered">';
    echo '<tr><td><strong>API Key Configured</strong></td>';
    echo '<td>' . (!empty($apiKey) ? '<span class="label label-success">Yes</span>' : '<span class="label label-danger">No</span>') . '</td></tr>';
    echo '<tr><td><strong>Rate Limit</strong></td><td>' . htmlspecialchars($rateLimit) . ' requests/minute</td></tr>';
    echo '<tr><td><strong>Version</strong></td><td>' . MRRLYTICS_VERSION . '</td></tr>';
    echo '</table>';
    echo '</div>';
    
    // Statistics
    echo '<div class="col-md-6">';
    echo '<h4>Usage Statistics (Last Hour)</h4>';
    echo '<table class="table table-bordered">';
    echo '<tr><td><strong>Total Requests</strong></td><td>' . $stats['total_requests'] . '</td></tr>';
    echo '<tr><td><strong>Unique IPs</strong></td><td>' . $stats['unique_ips'] . '</td></tr>';
    echo '</table>';
    echo '</div>';
    echo '</div>';
    
    // Endpoint information
    echo '<hr>';
    echo '<h4>Extraction Endpoint</h4>';
    echo '<div class="alert alert-info">';
    echo '<strong>URL:</strong> <code id="mrrlytics-endpoint-url" style="user-select: all;">' . htmlspecialchars($endpointUrl) . '</code> ';
    echo '<button type="button" class="btn btn-xs btn-success" onclick="mrrlytics_copyEndpoint()">Copy URL</button>';
    echo '</div>';
    
    // Usage example
    echo '<h4>Usage Example (cURL)</h4>';
    echo '<pre style="background: #f5f5f5; padding: 15px; border-radius: 4px;">';
    $curlExample = 'curl -X GET "' . $endpointUrl . '?limit=1000&offset=0" \\' . "\n";
    $curlExample .= '  -H "X-MRRlytics-Key: ' . (!empty($apiKey) ? $apiKey : 'YOUR_API_KEY') . '" \\' . "\n";
    $curlExample .= '  -H "Accept: application/json"';
    echo htmlspecialchars($curlExample);
    echo '</pre>';
    
    // Debug mode info
    echo '<div class="alert alert-warning">';
    echo '<strong>Debug Mode:</strong> Add <code>?debug=1</code> to the URL to see detailed error information if something fails.';
    echo '</div>';
    
    // Available parameters
    echo '<h4>Available Parameters</h4>';
    echo '<table class="table table-bordered table-striped">';
    echo '<thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead>';
    echo '<tbody>';
    echo '<tr><td><code>limit</code></td><td>int</td><td>1000</td><td>Records per table (max 5000)</td></tr>';
    echo '<tr><td><code>offset</code></td><td>int</td><td>0</td><td>Offset for pagination</td></tr>';
    echo '<tr><td><code>since</code></td><td>string</td><td>null</td><td>ISO8601 date to filter modified records</td></tr>';
    echo '<tr><td><code>debug</code></td><td>int</td><td>0</td><td>Set to 1 to enable debug mode</td></tr>';
    echo '</tbody></table>';
    
    echo '</div>'; // .panel-body
    echo '</div>'; // .panel
    
    // JavaScript for copy and toggle functionality
    echo '<script>
    var mrrlytics_keyVisible = true;
    var mrrlytics_fullKey = "' . addslashes($apiKey) . '";
    
    function mrrlytics_copyApiKey() {
        var textToCopy = mrrlytics_fullKey;
        
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(function() {
                alert("API Key copied to clipboard!");
            }).catch(function() {
                mrrlytics_fallbackCopy(textToCopy);
            });
        } else {
            mrrlytics_fallbackCopy(textToCopy);
        }
    }
    
    function mrrlytics_fallbackCopy(text) {
        var tempInput = document.createElement("textarea");
        tempInput.value = text;
        tempInput.style.position = "fixed";
        tempInput.style.opacity = "0";
        document.body.appendChild(tempInput);
        tempInput.focus();
        tempInput.select();
        try {
            document.execCommand("copy");
            alert("API Key copied to clipboard!");
        } catch (err) {
            alert("Failed to copy. Please select and copy manually.");
        }
        document.body.removeChild(tempInput);
    }
    
    function mrrlytics_copyEndpoint() {
        var url = document.getElementById("mrrlytics-endpoint-url").innerText;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function() {
                alert("Endpoint URL copied to clipboard!");
            }).catch(function() {
                mrrlytics_fallbackCopy(url);
            });
        } else {
            mrrlytics_fallbackCopy(url);
        }
    }
    
    function mrrlytics_toggleApiKey() {
        var input = document.getElementById("mrrlytics-api-key");
        var btn = document.getElementById("mrrlytics-toggle-btn");
        var maskedKey = mrrlytics_fullKey.substring(0, 8) + "' . str_repeat('*', 48) . '" + mrrlytics_fullKey.substring(mrrlytics_fullKey.length - 8);
        
        if (mrrlytics_keyVisible) {
            input.value = maskedKey;
            btn.innerText = "Show";
            mrrlytics_keyVisible = false;
        } else {
            input.value = mrrlytics_fullKey;
            btn.innerText = "Hide";
            mrrlytics_keyVisible = true;
        }
    }
    </script>';
}

/**
 * Get addon usage statistics
 * 
 * @return array
 */
function mrrlytics_getStats()
{
    try {
        $oneHourAgo = time() - 3600;
        
        $totalRequests = Capsule::table('mod_mrrlytics_ratelimit')
            ->where('request_time', '>=', $oneHourAgo)
            ->count();
        
        $uniqueIps = Capsule::table('mod_mrrlytics_ratelimit')
            ->where('request_time', '>=', $oneHourAgo)
            ->distinct('ip_address')
            ->count('ip_address');
        
        return [
            'total_requests' => $totalRequests,
            'unique_ips'     => $uniqueIps,
        ];
    } catch (\Exception $e) {
        return [
            'total_requests' => 0,
            'unique_ips'     => 0,
        ];
    }
}

/**
 * Addon sidebar output
 * 
 * @param array $vars Addon variables
 * 
 * @return string
 */
function mrrlytics_sidebar($vars)
{
    return '<span class="header">Useful Links</span>
            <ul class="menu">
                <li><a href="https://github.com/mrrlytics/mrrlytics-whmcs" target="_blank">Documentation</a></li>
                <li><a href="configaddonmods.php">Configuration</a></li>
            </ul>';
}
