<?php
/**
 * MRRlytics JSON Export Generator
 * 
 * Generates a JSON export file by writing directly to disk in chunks.
 * This avoids memory limits and timeout issues.
 * 
 * @package    MRRlytics
 * @author     MRRlytics Team
 * @version    1.0.0
 */

// Prevent direct access
if (!defined('WHMCS')) {
    $whmcsInitPath = __DIR__ . '/../../../init.php';
    if (!file_exists($whmcsInitPath)) {
        die('WHMCS not found');
    }
    require_once $whmcsInitPath;
}

use Illuminate\Database\Capsule\Manager as Capsule;

/**
 * Export data to JSON file
 */
class MRRlyticsExporter
{
    private $exportDir;
    private $chunkSize = 500;
    private $errors = [];
    
    public function __construct()
    {
        $this->exportDir = __DIR__ . '/exports';
        
        // Create exports directory if not exists
        if (!is_dir($this->exportDir)) {
            mkdir($this->exportDir, 0755, true);
        }
    }
    
    /**
     * Run the full export
     * 
     * @return array Result with filename or errors
     */
    public function run()
    {
        $filename = 'mrrlytics_export_' . date('Y-m-d_His') . '.json';
        $filepath = $this->exportDir . '/' . $filename;
        
        $handle = fopen($filepath, 'w');
        if (!$handle) {
            return ['success' => false, 'error' => 'Cannot create export file'];
        }
        
        // Start JSON
        fwrite($handle, "{\n");
        fwrite($handle, '"meta": ' . json_encode($this->getMeta()) . ",\n");
        fwrite($handle, '"data": {' . "\n");
        
        $tables = [
            'hosting' => 'tblhosting',
            'domains' => 'tbldomains', 
            'products' => 'tblproducts',
            'product_groups' => 'tblproductgroups',
            'billable_items' => 'tblbillableitems',
            'invoices' => 'tblinvoices',
            'invoice_items' => 'tblinvoiceitems',
            'clients' => 'tblclients',
            'cancellation_requests' => 'tblcancelrequests',
        ];
        
        $tableIndex = 0;
        $tableCount = count($tables);
        $recordCounts = [];
        
        foreach ($tables as $key => $table) {
            $tableIndex++;
            $isLast = ($tableIndex === $tableCount);
            
            $count = $this->exportTable($handle, $key, $table, $isLast);
            $recordCounts[$key] = $count;
        }
        
        // Close JSON
        fwrite($handle, "},\n");
        fwrite($handle, '"record_counts": ' . json_encode($recordCounts) . ",\n");
        fwrite($handle, '"errors": ' . json_encode($this->errors) . ",\n");
        fwrite($handle, '"success": ' . (empty($this->errors) ? 'true' : 'false') . "\n");
        fwrite($handle, "}\n");
        
        fclose($handle);
        
        // Get file size
        $filesize = filesize($filepath);
        
        return [
            'success' => true,
            'filename' => $filename,
            'filepath' => $filepath,
            'filesize' => $filesize,
            'filesize_human' => $this->formatBytes($filesize),
            'record_counts' => $recordCounts,
            'errors' => $this->errors,
        ];
    }
    
    /**
     * Export a single table to the file handle
     */
    private function exportTable($handle, $key, $table, $isLast)
    {
        fwrite($handle, '"' . $key . '": [' . "\n");
        
        $count = 0;
        $offset = 0;
        $firstRecord = true;
        
        try {
            // Check if table exists
            if (!Capsule::schema()->hasTable($table)) {
                fwrite($handle, ']' . ($isLast ? "\n" : ",\n"));
                return 0;
            }
            
            // Get columns to select based on table
            $columns = $this->getColumnsForTable($key);
            
            while (true) {
                $query = Capsule::table($table);
                
                if (!empty($columns)) {
                    // Try to select specific columns, fall back to * if fails
                    try {
                        $existingColumns = Capsule::schema()->getColumnListing($table);
                        $validColumns = array_intersect($columns, $existingColumns);
                        if (!empty($validColumns)) {
                            $query->select($validColumns);
                        }
                    } catch (\Exception $e) {
                        // Use all columns
                    }
                }
                
                $rows = $query->orderBy('id', 'asc')
                    ->limit($this->chunkSize)
                    ->offset($offset)
                    ->get();
                
                if (method_exists($rows, 'toArray')) {
                    $rows = $rows->toArray();
                }
                
                if (empty($rows)) {
                    break;
                }
                
                foreach ($rows as $row) {
                    if (!$firstRecord) {
                        fwrite($handle, ",\n");
                    }
                    fwrite($handle, json_encode((array) $row, JSON_UNESCAPED_UNICODE));
                    $firstRecord = false;
                    $count++;
                }
                
                $offset += $this->chunkSize;
                
                // Safety limit
                if ($offset > 500000) {
                    $this->errors[$key] = 'Reached safety limit of 500k records';
                    break;
                }
            }
        } catch (\Exception $e) {
            $this->errors[$key] = $e->getMessage();
        }
        
        fwrite($handle, "\n]" . ($isLast ? "\n" : ",\n"));
        
        return $count;
    }
    
    /**
     * Get columns to select for each table
     */
    private function getColumnsForTable($key)
    {
        $columns = [
            'hosting' => [
                'id', 'userid', 'orderid', 'packageid', 'server', 'regdate', 'domain',
                'paymentmethod', 'firstpaymentamount', 'amount', 'billingcycle',
                'nextduedate', 'nextinvoicedate', 'domainstatus', 'terminationdate',
                'suspendreason', 'created_at', 'updated_at',
            ],
            'domains' => [
                'id', 'userid', 'orderid', 'type', 'registrationdate', 'domain',
                'firstpaymentamount', 'recurringamount', 'registrationperiod',
                'expirydate', 'nextduedate', 'nextinvoicedate', 'paymentmethod',
                'status', 'donotrenew', 'created_at', 'updated_at',
            ],
            'products' => [
                'id', 'gid', 'type', 'name', 'description', 'hidden', 'paytype',
                'tax', 'retired', 'created_at', 'updated_at',
            ],
            'product_groups' => [
                'id', 'name', 'slug', 'hidden', 'created_at', 'updated_at',
            ],
            'billable_items' => [
                'id', 'userid', 'description', 'amount', 'recur', 'recurcycle',
                'recurfor', 'duedate', 'invoicecount', 'created_at', 'updated_at',
            ],
            'invoices' => [
                'id', 'userid', 'invoicenum', 'date', 'duedate', 'datepaid',
                'subtotal', 'credit', 'tax', 'tax2', 'total', 'status',
                'paymentmethod', 'created_at', 'updated_at',
            ],
            'invoice_items' => [
                'id', 'invoiceid', 'userid', 'type', 'relid', 'description',
                'amount', 'taxed', 'duedate', 'created_at', 'updated_at',
            ],
            'clients' => [
                'id', 'currency', 'defaultgateway', 'groupid', 'datecreated',
                'status', 'lastlogin', 'credit', 'language', 'created_at', 'updated_at',
            ],
            'cancellation_requests' => [
                'id', 'relid', 'reason', 'type', 'created_at', 'updated_at',
            ],
        ];
        
        return isset($columns[$key]) ? $columns[$key] : [];
    }
    
    /**
     * Get export metadata
     */
    private function getMeta()
    {
        $whmcsVersion = 'unknown';
        try {
            $version = Capsule::table('tblconfiguration')
                ->where('setting', 'Version')
                ->value('value');
            if ($version) {
                $whmcsVersion = $version;
            }
        } catch (\Exception $e) {}
        
        return [
            'whmcs_version' => $whmcsVersion,
            'php_version' => PHP_VERSION,
            'exported_at' => gmdate('Y-m-d\TH:i:s\Z'),
            'timezone' => date_default_timezone_get(),
        ];
    }
    
    /**
     * Format bytes to human readable
     */
    private function formatBytes($bytes)
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;
        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }
        return round($bytes, 2) . ' ' . $units[$i];
    }
    
    /**
     * List available export files
     */
    public function listExports()
    {
        $files = [];
        
        if (is_dir($this->exportDir)) {
            $items = scandir($this->exportDir, SCANDIR_SORT_DESCENDING);
            foreach ($items as $item) {
                if (preg_match('/^mrrlytics_export_.*\.json$/', $item)) {
                    $filepath = $this->exportDir . '/' . $item;
                    $files[] = [
                        'filename' => $item,
                        'filesize' => filesize($filepath),
                        'filesize_human' => $this->formatBytes(filesize($filepath)),
                        'created' => date('Y-m-d H:i:s', filemtime($filepath)),
                    ];
                }
            }
        }
        
        return $files;
    }
    
    /**
     * Delete an export file
     */
    public function deleteExport($filename)
    {
        // Sanitize filename
        $filename = basename($filename);
        if (!preg_match('/^mrrlytics_export_.*\.json$/', $filename)) {
            return false;
        }
        
        $filepath = $this->exportDir . '/' . $filename;
        if (file_exists($filepath)) {
            return unlink($filepath);
        }
        
        return false;
    }
    
    /**
     * Get export file path
     */
    public function getExportPath($filename)
    {
        $filename = basename($filename);
        if (!preg_match('/^mrrlytics_export_.*\.json$/', $filename)) {
            return null;
        }
        
        $filepath = $this->exportDir . '/' . $filename;
        if (file_exists($filepath)) {
            return $filepath;
        }
        
        return null;
    }
}
