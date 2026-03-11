# MRRlytics - WHMCS Data Extraction Addon

A secure WHMCS addon that exposes a read-only API endpoint for extracting billing and service data in JSON format. Designed for integration with external analytics platforms like Next.js + Supabase.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Usage](#api-usage)
  - [Authentication](#authentication)
  - [Parameters](#parameters)
  - [Response Format](#response-format)
  - [HTTP Status Codes](#http-status-codes)
- [Integration Examples](#integration-examples)
  - [cURL](#curl)
  - [JavaScript / Node.js](#javascript--nodejs)
  - [PHP](#php)
  - [Python](#python)
- [Extracted Data](#extracted-data)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Changelog](#changelog)
- [License](#license)

---

## Features

- **Secure Authentication**: API key validation with constant-time comparison to prevent timing attacks
- **Rate Limiting**: Configurable per-IP rate limiting with sliding window algorithm
- **Incremental Sync**: Filter records by modification date using the `since` parameter
- **Pagination**: Support for `limit` and `offset` parameters for large datasets
- **Read-Only**: Extracts data without any write operations
- **Version Compatible**: Automatic column detection for cross-version WHMCS compatibility
- **JSON Output**: Clean, structured JSON responses with metadata

---

## Requirements

| Component | Minimum Version | Recommended |
|-----------|-----------------|-------------|
| WHMCS | 8.0 | 8.8+ |
| PHP | 7.2 | 8.1+ |
| MySQL | 5.7 | 8.0+ |
| MariaDB | 10.2 | 10.6+ |

### Compatibility Matrix

| WHMCS Version | PHP 7.2 | PHP 7.4 | PHP 8.0 | PHP 8.1 | PHP 8.2 |
|---------------|---------|---------|---------|---------|---------|
| 8.0 - 8.5 | Yes | Yes | Yes | - | - |
| 8.6 - 8.7 | - | Yes | Yes | Yes | - |
| 8.8 - 8.10 | - | - | Yes | Yes | - |
| 8.11+ | - | - | - | Yes | Yes |

---

## Installation

### Step 1: Upload Files

Upload the `mrrlytics` folder to your WHMCS installation:

```
/path/to/whmcs/modules/addons/mrrlytics/
├── mrrlytics.php
├── api.php
├── lib/
│   └── DataExtractor.php
└── README.md
```

### Step 2: Set Permissions

Ensure proper file permissions:

```bash
chmod 644 modules/addons/mrrlytics/*.php
chmod 644 modules/addons/mrrlytics/lib/*.php
chmod 755 modules/addons/mrrlytics/
chmod 755 modules/addons/mrrlytics/lib/
```

### Step 3: Activate the Addon

1. Log in to WHMCS Admin Area
2. Navigate to **Setup** > **Addon Modules**
3. Find **MRRlytics** and click **Activate**
4. Click **Configure** to set up the API key

---

## Configuration

### API Key

Generate a secure API key (minimum 32 characters recommended):

```bash
# Linux/macOS
openssl rand -hex 32

# Or use PHP
php -r "echo bin2hex(random_bytes(32)) . PHP_EOL;"
```

Enter this key in the addon configuration:

1. Go to **Setup** > **Addon Modules**
2. Click **Configure** next to MRRlytics
3. Paste your API key in the **API Key** field
4. Click **Save Changes**

### Rate Limit

Configure the maximum requests per minute per IP address. Default is `60`.

For high-volume synchronization, you may increase this value. Consider your server capacity when adjusting.

---

## API Usage

### Endpoint URL

```
https://your-whmcs-domain.com/modules/addons/mrrlytics/api.php
```

### Authentication

Include your API key in the `X-MRRlytics-Key` header:

```
X-MRRlytics-Key: your-api-key-here
```

### Parameters

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `limit` | integer | 1000 | 1-5000 | Maximum records per table |
| `offset` | integer | 0 | 0+ | Pagination offset |
| `since` | string | null | ISO8601 | Filter records modified after this date |

#### Date Format Examples

```
since=2024-01-01T00:00:00Z
since=2024-06-15T14:30:00+00:00
since=2024-03-20
```

### Response Format

#### Successful Response (200 OK)

```json
{
  "success": true,
  "meta": {
    "whmcs_version": "8.10.1",
    "php_version": "8.1.27",
    "timezone": "UTC",
    "exported_at": "2024-06-15T10:30:00Z",
    "pagination": {
      "limit": 1000,
      "offset": 0
    },
    "filters": {
      "since": "2024-01-01 00:00:00"
    },
    "record_counts": {
      "hosting": 342,
      "domains": 128,
      "products": 45,
      "product_groups": 8,
      "billable_items": 67,
      "invoices": 891,
      "invoice_items": 2341,
      "clients": 289
    }
  },
  "data": {
    "hosting": [...],
    "domains": [...],
    "products": [...],
    "product_groups": [...],
    "billable_items": [...],
    "invoices": [...],
    "invoice_items": [...],
    "clients": [...]
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": {
    "code": 401,
    "message": "Invalid API key."
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid API key |
| 405 | Method Not Allowed - Use GET only |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Rate Limit Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
Retry-After: 45  (only on 429 responses)
```

---

## Integration Examples

### cURL

```bash
# Basic request
curl -X GET "https://whmcs.example.com/modules/addons/mrrlytics/api.php" \
  -H "X-MRRlytics-Key: your-api-key-here" \
  -H "Accept: application/json"

# With pagination
curl -X GET "https://whmcs.example.com/modules/addons/mrrlytics/api.php?limit=500&offset=0" \
  -H "X-MRRlytics-Key: your-api-key-here"

# Incremental sync (records since January 1st, 2024)
curl -X GET "https://whmcs.example.com/modules/addons/mrrlytics/api.php?since=2024-01-01T00:00:00Z" \
  -H "X-MRRlytics-Key: your-api-key-here"
```

### JavaScript / Node.js

```javascript
// Using fetch (Node.js 18+ or browser)
async function fetchWHMCSData(options = {}) {
  const { limit = 1000, offset = 0, since = null } = options;
  
  const params = new URLSearchParams({ limit, offset });
  if (since) params.append('since', since);
  
  const response = await fetch(
    `https://whmcs.example.com/modules/addons/mrrlytics/api.php?${params}`,
    {
      method: 'GET',
      headers: {
        'X-MRRlytics-Key': process.env.WHMCS_API_KEY,
        'Accept': 'application/json',
      },
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Request failed');
  }
  
  return response.json();
}

// Usage
try {
  const data = await fetchWHMCSData({ limit: 500, since: '2024-01-01T00:00:00Z' });
  console.log(`Fetched ${data.meta.record_counts.invoices} invoices`);
  
  // Insert into Supabase
  const { error } = await supabase.from('whmcs_invoices').upsert(data.data.invoices);
  if (error) throw error;
} catch (err) {
  console.error('Sync failed:', err.message);
}
```

### PHP

```php
<?php

function fetchMRRlyticsData(array $options = []): array
{
    $baseUrl = 'https://whmcs.example.com/modules/addons/mrrlytics/api.php';
    $apiKey = getenv('WHMCS_MRRLYTICS_KEY');
    
    $params = array_merge([
        'limit'  => 1000,
        'offset' => 0,
    ], $options);
    
    $url = $baseUrl . '?' . http_build_query($params);
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'X-MRRlytics-Key: ' . $apiKey,
            'Accept: application/json',
        ],
        CURLOPT_TIMEOUT        => 120,
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $data = json_decode($response, true);
    
    if ($httpCode !== 200 || !$data['success']) {
        throw new Exception($data['error']['message'] ?? 'Request failed');
    }
    
    return $data;
}

// Usage
try {
    $data = fetchMRRlyticsData([
        'limit' => 500,
        'since' => '2024-01-01T00:00:00Z',
    ]);
    
    echo "Fetched {$data['meta']['record_counts']['invoices']} invoices\n";
    
    // Process data...
    foreach ($data['data']['invoices'] as $invoice) {
        // Insert into your database
    }
} catch (Exception $e) {
    error_log('MRRlytics sync failed: ' . $e->getMessage());
}
```

### Python

```python
import os
import requests
from datetime import datetime
from typing import Optional

class MRRlyticsClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'X-MRRlytics-Key': api_key,
            'Accept': 'application/json',
        })
    
    def fetch(
        self,
        limit: int = 1000,
        offset: int = 0,
        since: Optional[str] = None
    ) -> dict:
        """
        Fetch data from MRRlytics endpoint.
        
        Args:
            limit: Maximum records per table (1-5000)
            offset: Pagination offset
            since: ISO8601 date string for incremental sync
            
        Returns:
            dict: API response with meta and data
            
        Raises:
            requests.HTTPError: On API error
        """
        params = {'limit': limit, 'offset': offset}
        if since:
            params['since'] = since
        
        response = self.session.get(
            f"{self.base_url}/modules/addons/mrrlytics/api.php",
            params=params,
            timeout=120
        )
        
        data = response.json()
        
        if not response.ok or not data.get('success'):
            error_msg = data.get('error', {}).get('message', 'Unknown error')
            raise requests.HTTPError(f"API Error: {error_msg}")
        
        return data
    
    def fetch_all(self, since: Optional[str] = None, batch_size: int = 1000) -> dict:
        """
        Fetch all records with automatic pagination.
        
        Args:
            since: ISO8601 date string for incremental sync
            batch_size: Records per request
            
        Returns:
            dict: Combined data from all pages
        """
        all_data = {
            'hosting': [],
            'domains': [],
            'products': [],
            'product_groups': [],
            'billable_items': [],
            'invoices': [],
            'invoice_items': [],
            'clients': [],
        }
        
        offset = 0
        while True:
            result = self.fetch(limit=batch_size, offset=offset, since=since)
            
            for key in all_data:
                all_data[key].extend(result['data'].get(key, []))
            
            # Check if we got less than batch_size (last page)
            total_records = sum(result['meta']['record_counts'].values())
            if total_records < batch_size * 8:  # 8 tables
                break
            
            offset += batch_size
        
        return all_data


# Usage
if __name__ == '__main__':
    client = MRRlyticsClient(
        base_url='https://whmcs.example.com',
        api_key=os.environ['WHMCS_MRRLYTICS_KEY']
    )
    
    # Single fetch
    data = client.fetch(limit=500, since='2024-01-01T00:00:00Z')
    print(f"Fetched {data['meta']['record_counts']['invoices']} invoices")
    
    # Fetch all with pagination
    all_data = client.fetch_all(since='2024-01-01T00:00:00Z')
    print(f"Total invoices: {len(all_data['invoices'])}")
    
    # Insert into database (example with SQLAlchemy)
    # for invoice in all_data['invoices']:
    #     db.session.merge(Invoice(**invoice))
    # db.session.commit()
```

---

## Extracted Data

### Tables and Fields

#### `hosting` (tblhosting)

Services and hosting accounts.

| Field | Type | Description |
|-------|------|-------------|
| id | int | Service ID |
| userid | int | Client ID |
| packageid | int | Product ID |
| domain | string | Associated domain |
| amount | decimal | Recurring amount |
| billingcycle | string | Billing cycle (Monthly, Annually, etc.) |
| domainstatus | string | Status (Active, Suspended, etc.) |
| nextduedate | date | Next payment due date |
| regdate | date | Registration date |

#### `domains` (tbldomains)

Domain registrations.

| Field | Type | Description |
|-------|------|-------------|
| id | int | Domain ID |
| userid | int | Client ID |
| domain | string | Domain name |
| recurringamount | decimal | Renewal amount |
| registrationperiod | int | Registration period in years |
| expirydate | date | Expiration date |
| status | string | Status (Active, Expired, etc.) |

#### `products` (tblproducts)

Product catalog.

| Field | Type | Description |
|-------|------|-------------|
| id | int | Product ID |
| gid | int | Product group ID |
| name | string | Product name |
| type | string | Product type |
| paytype | string | Payment type (recurring, onetime, free) |

#### `product_groups` (tblproductgroups)

Product group/categories.

| Field | Type | Description |
|-------|------|-------------|
| id | int | Group ID |
| name | string | Group name |
| hidden | int | Is hidden (0/1) |

#### `billable_items` (tblbillableitems)

Custom billable items.

| Field | Type | Description |
|-------|------|-------------|
| id | int | Item ID |
| userid | int | Client ID |
| amount | decimal | Item amount |
| recur | int | Recurring (0/1) |
| recurcycle | string | Recurrence cycle |

#### `invoices` (tblinvoices)

Invoice headers.

| Field | Type | Description |
|-------|------|-------------|
| id | int | Invoice ID |
| userid | int | Client ID |
| total | decimal | Invoice total |
| status | string | Status (Paid, Unpaid, Cancelled) |
| datepaid | datetime | Payment date |
| paymentmethod | string | Payment method |

#### `invoice_items` (tblinvoiceitems)

Invoice line items.

| Field | Type | Description |
|-------|------|-------------|
| id | int | Line item ID |
| invoiceid | int | Invoice ID |
| type | string | Item type (Hosting, Domain, etc.) |
| relid | int | Related item ID |
| amount | decimal | Line amount |

#### `clients` (tblclients)

Basic client data (non-sensitive).

| Field | Type | Description |
|-------|------|-------------|
| id | int | Client ID |
| currency | int | Currency ID |
| status | string | Status (Active, Inactive, Closed) |
| datecreated | date | Registration date |

---

## Security

### Authentication Security

- **Timing Attack Prevention**: API key comparison uses `hash_equals()` for constant-time comparison
- **No Key Exposure**: API key is stored in WHMCS database, not in files

### Rate Limiting

- Sliding window algorithm (1-minute windows)
- Per-IP tracking with automatic cleanup
- Configurable limits via admin panel

### Data Protection

- **Read-Only**: No write operations possible through API
- **Minimal Client Data**: Only non-PII fields extracted from clients table
- **No Passwords**: No sensitive credentials are exposed

### Recommended Practices

1. **Use HTTPS**: Always access the endpoint over HTTPS
2. **Strong API Keys**: Use at least 32 random characters
3. **IP Whitelist**: Consider firewall rules to restrict access
4. **Rotate Keys**: Periodically rotate API keys
5. **Monitor Usage**: Check the addon panel for unusual activity

---

## Troubleshooting

### Common Issues

#### "WHMCS framework not found" (500 Error)

The `init.php` file path is incorrect. Verify the addon is installed in the correct location:

```
modules/addons/mrrlytics/api.php
```

#### "API key not configured" (500 Error)

Configure the API key in WHMCS Admin:
1. Go to **Setup** > **Addon Modules**
2. Click **Configure** next to MRRlytics
3. Enter your API key

#### "Invalid API key" (401 Error)

- Verify you're using the correct API key
- Check for whitespace in the header value
- Ensure the key matches exactly (case-sensitive)

#### "Rate limit exceeded" (429 Error)

Wait for the `Retry-After` seconds or increase the rate limit in configuration.

#### Empty data arrays

- Check if the `since` parameter is filtering out all records
- Verify the tables have data in WHMCS
- Check WHMCS error logs for database errors

### Debug Mode

To enable detailed error logging, add to your WHMCS `configuration.php`:

```php
$display_errors = 1;
error_reporting(E_ALL);
```

**Important**: Disable this in production.

---

## Changelog

### v1.0.0 (2024-06-15)

- Initial release
- Support for 8 WHMCS tables
- API key authentication with timing attack prevention
- Per-IP rate limiting
- Incremental sync with `since` parameter
- Pagination support
- Automatic column compatibility detection

---

## License

This project is licensed under the MIT License.

```
MIT License

Copyright (c) 2024 MRRlytics Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Support

For issues and feature requests, please open an issue on the GitHub repository.
