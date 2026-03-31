<?php
/**
 * MRRlytics Data Extractor
 * 
 * Class responsible for executing SQL queries and formatting the final JSON payload.
 * Extracts billing and service data from WHMCS securely.
 * 
 * @package    MRRlytics
 * @author     MRRlytics Team
 * @version    1.1.0
 * @license    MIT
 * 
 * @requires   PHP 7.2+
 * @requires   WHMCS 8.0+
 */

namespace MRRlytics;

use Illuminate\Database\Capsule\Manager as Capsule;

class DataExtractor
{
    const VERSION = '1.3.0';

    /**
     * Record limit per table
     * 
     * @var int
     */
    private $limit;
    
    /**
     * Offset for pagination
     * 
     * @var int
     */
    private $offset;
    
    /**
     * Date filter (records modified after this date)
     * 
     * @var string|null
     */
    private $since;
    
    /**
     * Debug mode flag
     * 
     * @var bool
     */
    private $debug;
    
    /**
     * Record counts per table
     * 
     * @var array
     */
    private $recordCounts = [];
    
    /**
     * Errors encountered during extraction
     * 
     * @var array
     */
    private $errors = [];
    
    /**
     * Schema cache for column listing
     * 
     * @var array
     */
    private static $schemaCache = [];
    
    /**
     * Constructor
     * 
     * @param int         $limit  Record limit per table (default: 1000)
     * @param int         $offset Offset for pagination (default: 0)
     * @param string|null $since  ISO8601 date to filter records
     * @param bool        $debug  Enable debug mode (default: false)
     */
    public function __construct($limit = 1000, $offset = 0, $since = null, $debug = false)
    {
        $this->limit = (int) $limit;
        $this->offset = (int) $offset;
        $this->since = $since;
        $this->debug = (bool) $debug;
    }
    
    /**
     * Execute the complete data extraction
     * 
     * @return array Structured payload with meta and data
     */
    public function extract()
    {
        $data = [];
        
        // Extract each table with individual error handling
        $data['hosting'] = $this->safeExtract('hosting', function() {
            return $this->getHosting();
        });
        
        $data['domains'] = $this->safeExtract('domains', function() {
            return $this->getDomains();
        });
        
        $data['products'] = $this->safeExtract('products', function() {
            return $this->getProducts();
        });
        
        $data['product_groups'] = $this->safeExtract('product_groups', function() {
            return $this->getProductGroups();
        });
        
        $data['billable_items'] = $this->safeExtract('billable_items', function() {
            return $this->getBillableItems();
        });
        
        $data['invoices'] = $this->safeExtract('invoices', function() {
            return $this->getInvoices();
        });
        
        $data['invoice_items'] = $this->safeExtract('invoice_items', function() {
            return $this->getInvoiceItems();
        });
        
        $data['clients'] = $this->safeExtract('clients', function() {
            return $this->getClients();
        });
        
        $data['cancellation_requests'] = $this->safeExtract('cancellation_requests', function() {
            return $this->getCancellationRequests();
        });

        $data['client_closures'] = $this->safeExtract('client_closures', function() {
            return $this->getClientClosures();
        });

        $response = [
            'success' => empty($this->errors),
            'meta'    => $this->getMeta(),
            'data'    => $data,
        ];
        
        // Include errors if any occurred
        if (!empty($this->errors)) {
            $response['errors'] = $this->errors;
        }
        
        return $response;
    }
    
    /**
     * Safely extract data with error handling
     * 
     * @param string   $tableName Name of the table/dataset
     * @param callable $extractor Function to execute
     * 
     * @return array
     */
    private function safeExtract($tableName, callable $extractor)
    {
        try {
            return $extractor();
        } catch (\Exception $e) {
            $errorInfo = [
                'message' => $e->getMessage(),
            ];
            
            if ($this->debug) {
                $errorInfo['file'] = $e->getFile();
                $errorInfo['line'] = $e->getLine();
            }
            
            $this->errors[$tableName] = $errorInfo;
            $this->recordCounts[$tableName] = 0;
            
            return [];
        }
    }
    
    /**
     * Generate export metadata
     * 
     * @return array
     */
    private function getMeta()
    {
        // Get WHMCS version
        $whmcsVersion = 'unknown';
        
        // Try different methods to get WHMCS version
        if (defined('WHMCS\\Application\\Application::VERSION')) {
            $whmcsVersion = constant('WHMCS\\Application\\Application::VERSION');
        } elseif (class_exists('\\App') && method_exists('\\App', 'getVersion')) {
            try {
                $whmcsVersion = \App::getVersion()->getCasual();
            } catch (\Exception $e) {
                // Keep 'unknown'
            }
        } else {
            // Fallback: try to read from configuration table
            try {
                $version = Capsule::table('tblconfiguration')
                    ->where('setting', 'Version')
                    ->value('value');
                if ($version) {
                    $whmcsVersion = $version;
                }
            } catch (\Exception $e) {
                // Keep 'unknown'
            }
        }
        
        return [
            'module_version' => self::VERSION,
            'whmcs_version' => $whmcsVersion,
            'php_version'   => PHP_VERSION,
            'timezone'      => date_default_timezone_get(),
            'exported_at'   => gmdate('Y-m-d\\TH:i:s\\Z'),
            'pagination'    => [
                'limit'  => $this->limit,
                'offset' => $this->offset,
            ],
            'filters' => [
                'since' => $this->since,
            ],
            'record_counts' => $this->recordCounts,
            'debug'         => $this->debug,
        ];
    }
    
    /**
     * Apply date filter to a query
     * 
     * @param \Illuminate\Database\Query\Builder $query             Query builder instance
     * @param string                             $primaryDateColumn Primary date column name
     * @param string|null                        $fallbackColumn    Fallback date column name
     * 
     * @return \Illuminate\Database\Query\Builder
     */
    private function applyDateFilter($query, $primaryDateColumn, $fallbackColumn = null)
    {
        if ($this->since === null) {
            return $query;
        }
        
        $since = $this->since;
        
        try {
            if ($fallbackColumn) {
                $query->where(function ($q) use ($primaryDateColumn, $fallbackColumn, $since) {
                    $q->where($primaryDateColumn, '>=', $since)
                      ->orWhere($fallbackColumn, '>=', $since);
                });
            } else {
                $query->where($primaryDateColumn, '>=', $since);
            }
        } catch (\Exception $e) {
            // If primary column fails, try fallback
            if ($fallbackColumn) {
                try {
                    $query->where($fallbackColumn, '>=', $since);
                } catch (\Exception $e2) {
                    // Silently continue without date filter
                }
            }
        }
        
        return $query;
    }
    
    /**
     * Apply pagination to a query
     * 
     * @param \Illuminate\Database\Query\Builder $query Query builder instance
     * 
     * @return \Illuminate\Database\Query\Builder
     */
    private function applyPagination($query)
    {
        return $query->limit($this->limit)->offset($this->offset);
    }
    
    /**
     * Execute a safe query with fallback to SELECT *
     * 
     * @param string      $table              Table name
     * @param array       $columns            Desired columns
     * @param string      $primaryDateColumn  Primary date column for filtering
     * @param string|null $fallbackDateColumn Fallback date column
     * 
     * @return array
     */
    private function safeQuery($table, $columns, $primaryDateColumn, $fallbackDateColumn = null)
    {
        // First try with filtered columns
        try {
            $filteredColumns = $this->filterExistingColumns($table, $columns);
            
            if (empty($filteredColumns)) {
                // If no columns match, try with all requested columns
                $filteredColumns = $columns;
            }
            
            $query = Capsule::table($table)->select($filteredColumns);
            $this->applyDateFilter($query, $primaryDateColumn, $fallbackDateColumn);
            $this->applyPagination($query);
            
            $results = $query->orderBy('id', 'asc')->get();
            return $this->collectionToArray($results);
            
        } catch (\Exception $e) {
            // Fallback: try with SELECT * and filter columns in PHP
            try {
                $query = Capsule::table($table);
                $this->applyPagination($query);
                
                $results = $query->orderBy('id', 'asc')->get();
                $results = $this->collectionToArray($results);
                
                // Filter to only include requested columns
                return $this->filterResultColumns($results, $columns);
                
            } catch (\Exception $e2) {
                // Re-throw with more context
                throw new \Exception("Failed to query {$table}: " . $e2->getMessage());
            }
        }
    }
    
    /**
     * Filter result columns to only include requested ones
     * 
     * @param array $results Query results
     * @param array $columns Desired columns
     * 
     * @return array
     */
    private function filterResultColumns($results, $columns)
    {
        $filtered = array_map(function ($row) use ($columns) {
            $row = (array) $row;
            return array_intersect_key($row, array_flip($columns));
        }, $results);
        
        // Re-index to ensure sequential numeric keys
        return array_values($filtered);
    }
    
    /**
     * Extract hosting/services data (tblhosting)
     * 
     * @return array
     */
    private function getHosting()
    {
        $columns = [
            'id',
            'userid',
            'orderid',
            'packageid',
            'server',
            'regdate',
            'domain',
            'paymentmethod',
            'firstpaymentamount',
            'amount',
            'billingcycle',
            'nextduedate',
            'nextinvoicedate',
            'domainstatus',
            'terminationdate',
            'username',
            'dedicatedip',
            'assignedips',
            'notes',
            'subscriptionid',
            'suspendreason',
            'overideautosuspend',
            'overidesuspenduntil',
            'created_at',
            'updated_at',
        ];
        
        $results = $this->safeQuery('tblhosting', $columns, 'updated_at', 'regdate');
        $this->recordCounts['hosting'] = count($results);
        
        return $this->convertToArrays($results);
    }
    
    /**
     * Extract domains data (tbldomains)
     * 
     * @return array
     */
    private function getDomains()
    {
        $columns = [
            'id',
            'userid',
            'orderid',
            'type',
            'registrationdate',
            'domain',
            'firstpaymentamount',
            'recurringamount',
            'registrationperiod',
            'expirydate',
            'nextduedate',
            'nextinvoicedate',
            'paymentmethod',
            'status',
            'dnsmanagement',
            'emailforwarding',
            'idprotection',
            'donotrenew',
            'created_at',
            'updated_at',
        ];
        
        $results = $this->safeQuery('tbldomains', $columns, 'updated_at', 'registrationdate');
        $this->recordCounts['domains'] = count($results);
        
        return $this->convertToArrays($results);
    }
    
    /**
     * Extract products data (tblproducts)
     * 
     * @return array
     */
    private function getProducts()
    {
        $columns = [
            'id',
            'gid',
            'type',
            'name',
            'description',
            'hidden',
            'showdomainoptions',
            'welcomeemail',
            'stockcontrol',
            'qty',
            'proratabilling',
            'proratadate',
            'proratachargenextmonth',
            'paytype',
            'allowqty',
            'subdomain',
            'autosetup',
            'servertype',
            'servergroup',
            'tax',
            'order',
            'retired',
            'is_featured',
            'created_at',
            'updated_at',
        ];
        
        // Add configoptions 1-24
        for ($i = 1; $i <= 24; $i++) {
            $columns[] = 'configoption' . $i;
        }
        
        $results = $this->safeQuery('tblproducts', $columns, 'updated_at', 'created_at');
        $this->recordCounts['products'] = count($results);
        
        return $this->convertToArrays($results);
    }
    
    /**
     * Extract product groups data (tblproductgroups)
     * 
     * @return array
     */
    private function getProductGroups()
    {
        $columns = [
            'id',
            'name',
            'slug',
            'headline',
            'tagline',
            'orderfrmtpl',
            'disabledgateways',
            'hidden',
            'order',
            'created_at',
            'updated_at',
        ];
        
        $results = $this->safeQuery('tblproductgroups', $columns, 'updated_at', 'created_at');
        $this->recordCounts['product_groups'] = count($results);
        
        return $this->convertToArrays($results);
    }
    
    /**
     * Extract billable items data (tblbillableitems)
     * 
     * @return array
     */
    private function getBillableItems()
    {
        $columns = [
            'id',
            'userid',
            'description',
            'hours',
            'amount',
            'recur',
            'recurcycle',
            'recurfor',
            'invoiceaction',
            'duedate',
            'invoicecount',
            'created_at',
            'updated_at',
        ];
        
        $results = $this->safeQuery('tblbillableitems', $columns, 'updated_at', 'duedate');
        $this->recordCounts['billable_items'] = count($results);
        
        return $this->convertToArrays($results);
    }
    
    /**
     * Extract invoices data (tblinvoices)
     * 
     * @return array
     */
    private function getInvoices()
    {
        $columns = [
            'id',
            'userid',
            'invoicenum',
            'date',
            'duedate',
            'datepaid',
            'subtotal',
            'credit',
            'tax',
            'tax2',
            'total',
            'taxrate',
            'taxrate2',
            'status',
            'paymentmethod',
            'notes',
            'created_at',
            'updated_at',
        ];
        
        $results = $this->safeQuery('tblinvoices', $columns, 'updated_at', 'datepaid');
        $this->recordCounts['invoices'] = count($results);
        
        return $this->convertToArrays($results);
    }
    
    /**
     * Extract invoice items/lines data (tblinvoiceitems)
     * 
     * @return array
     */
    private function getInvoiceItems()
    {
        $columns = [
            'id',
            'invoiceid',
            'userid',
            'type',
            'relid',
            'description',
            'amount',
            'taxed',
            'duedate',
            'paymentmethod',
            'notes',
            'created_at',
            'updated_at',
        ];
        
        $results = $this->safeQuery('tblinvoiceitems', $columns, 'updated_at', 'duedate');
        $this->recordCounts['invoice_items'] = count($results);
        
        return $this->convertToArrays($results);
    }
    
    /**
     * Extract basic client data (tblclients)
     * 
     * Extracts fields required for analytics including name/company for identification.
     * No sensitive PII (email, address, phone) is included.
     * 
     * @return array
     */
    private function getClients()
    {
        $columns = [
            'id',
            'firstname',
            'lastname',
            'companyname',
            'currency',
            'defaultgateway',
            'groupid',
            'datecreated',
            'status',
            'lastlogin',
            'credit',
            'latefeeoveride',
            'overideduenotices',
            'billingcid',
            'language',
            'created_at',
            'updated_at',
        ];
        
        $results = $this->safeQuery('tblclients', $columns, 'updated_at', 'datecreated');
        $this->recordCounts['clients'] = count($results);
        
        return $this->convertToArrays($results);
    }
    
    /**
     * Extract cancellation requests (tblcancelrequests)
     * 
     * Important for accurate churn tracking with exact dates.
     * 
     * @return array
     */
    private function getCancellationRequests()
    {
        // Check if table exists (may not exist in older WHMCS versions)
        try {
            $tableExists = Capsule::schema()->hasTable('tblcancelrequests');
            if (!$tableExists) {
                $this->recordCounts['cancellation_requests'] = 0;
                return [];
            }
        } catch (\Exception $e) {
            $this->recordCounts['cancellation_requests'] = 0;
            return [];
        }
        
        $columns = [
            'id',
            'relid',
            'reason',
            'type',
            'created_at',
            'updated_at',
        ];
        
        $results = $this->safeQuery('tblcancelrequests', $columns, 'created_at', 'updated_at');
        $this->recordCounts['cancellation_requests'] = count($results);

        return $this->convertToArrays($results);
    }

    /**
     * Extract client closure events from the activity log (tblactivitylog)
     *
     * Filters only entries where the description contains "Status changed to Closed"
     * to get the exact date each client was closed/churned.
     *
     * @return array
     */
    private function getClientClosures()
    {
        try {
            $tableExists = Capsule::schema()->hasTable('tblactivitylog');
            if (!$tableExists) {
                $this->recordCounts['client_closures'] = 0;
                return [];
            }
        } catch (\Exception $e) {
            $this->recordCounts['client_closures'] = 0;
            return [];
        }

        try {
            $query = Capsule::table('tblactivitylog')
                ->select(['id', 'userid', 'date', 'description'])
                ->where('userid', '>', 0)
                ->where('description', 'like', '%Status changed to Closed%');

            if ($this->since !== null) {
                $query->where('date', '>=', $this->since);
            }

            $results = $query->orderBy('id', 'asc')
                ->limit($this->limit)
                ->offset($this->offset)
                ->get();

            $rows = $this->collectionToArray($results);
            $this->recordCounts['client_closures'] = count($rows);
            return $rows;

        } catch (\Exception $e) {
            throw new \Exception('Failed to query tblactivitylog: ' . $e->getMessage());
        }
    }

    /**
     * Filter columns to include only those that exist in the table
     * 
     * This provides compatibility across different WHMCS versions
     * where column availability may vary.
     * 
     * @param string $table   Table name
     * @param array  $columns Desired columns
     * 
     * @return array Columns that exist in the table
     */
    private function filterExistingColumns($table, $columns)
    {
        if (!isset(self::$schemaCache[$table])) {
            try {
                self::$schemaCache[$table] = Capsule::schema()->getColumnListing($table);
            } catch (\Exception $e) {
                // If schema check fails, mark as null to trigger fallback
                self::$schemaCache[$table] = null;
            }
        }
        
        // If we couldn't get the schema, return all columns and let SQL handle it
        if (self::$schemaCache[$table] === null) {
            return $columns;
        }
        
        $filtered = array_values(array_intersect($columns, self::$schemaCache[$table]));
        
        // If no columns match, return original (will fail but with clear error)
        return !empty($filtered) ? $filtered : $columns;
    }
    
    /**
     * Convert Illuminate Collection to array
     * 
     * Provides compatibility across different Illuminate versions.
     * 
     * @param mixed $collection Query result
     * 
     * @return array
     */
    private function collectionToArray($collection)
    {
        if (is_array($collection)) {
            // Re-index to ensure sequential numeric keys (avoid sparse arrays)
            return array_values($collection);
        }
        
        if (method_exists($collection, 'toArray')) {
            // Re-index to ensure sequential numeric keys
            return array_values($collection->toArray());
        }
        
        return array_values((array) $collection);
    }
    
    /**
     * Convert stdClass objects to associative arrays
     * Also sanitizes string values to ensure valid JSON output
     * 
     * @param array $results Query results
     * 
     * @return array
     */
    private function convertToArrays($results)
    {
        $converted = array_map(function ($item) {
            if (is_object($item)) {
                $item = (array) $item;
            }
            // Sanitize string values
            if (is_array($item)) {
                foreach ($item as $key => $value) {
                    if (is_string($value)) {
                        // Remove invalid UTF-8 and control characters
                        $value = mb_convert_encoding($value, 'UTF-8', 'UTF-8');
                        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);
                        $item[$key] = $value;
                    }
                }
            }
            return $item;
        }, $results);
        
        // Re-index to ensure sequential numeric keys
        return array_values($converted);
    }
}
