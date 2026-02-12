// =============================================================================
// K6 Utilities - Common Functions for Load Testing
// =============================================================================

import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom Metrics
export const errorRate = new Rate('errors');
export const loginDuration = new Trend('login_duration');
export const apiRequestDuration = new Trend('api_request_duration');
export const failedRequests = new Counter('failed_requests');

// Configuration
export const BASE_URL = __ENV.API_URL || 'http://localhost:7175';

/**
 * Generate random number between min and max (inclusive)
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random email address
 */
export function randomEmail() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `loadtest_${timestamp}_${random}@example.com`;
}

/**
 * Generate random company name
 */
export function randomCompanyName() {
    const companies = [
        'Acme Corp', 'Tech Solutions', 'Global Services', 'Innovation Labs',
        'Digital Systems', 'Cloud Enterprises', 'Data Dynamics', 'Smart Solutions',
        'Future Tech', 'Quantum Systems', 'Apex Industries', 'Prime Ventures'
    ];
    return companies[randomInt(0, companies.length - 1)] + ' ' + randomInt(100, 999);
}

/**
 * Generate random client name
 */
export function randomClientName() {
    const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emma', 'Chris', 'Lisa'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    return firstNames[randomInt(0, firstNames.length - 1)] + ' ' + 
           lastNames[randomInt(0, lastNames.length - 1)];
}

/**
 * Generate invoice data
 */
export function generateInvoiceData(clientId) {
    const itemCount = randomInt(1, 5);
    const items = [];
    
    for (let i = 0; i < itemCount; i++) {
        items.push({
            description: `Service/Product ${i + 1}`,
            quantity: randomInt(1, 10),
            unitPrice: randomInt(50, 500),
            total: 0 // Will be calculated
        });
    }
    
    const totalAmount = items.reduce((sum, item) => {
        const total = item.quantity * item.unitPrice;
        item.total = total;
        return sum + total;
    }, 0);
    
    return {
        number: `INV-${Date.now()}-${randomInt(1000, 9999)}`,
        date: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        clientId: clientId,
        status: 'Unpaid',
        currency: 'USD',
        currencySymbol: '$',
        totalAmount: totalAmount,
        items: items
    };
}

/**
 * Think time - simulate user reading/thinking
 */
export function thinkTime(min = 1, max = 3) {
    sleep(randomInt(min, max));
}

/**
 * Check HTTP response and record metrics
 */
export function checkResponse(response, expectedStatus = 200, testName = 'request') {
    const success = check(response, {
        [`${testName}: status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
        [`${testName}: response time < 500ms`]: (r) => r.timings.duration < 500,
        [`${testName}: response time < 1000ms`]: (r) => r.timings.duration < 1000,
    });
    
    errorRate.add(!success);
    if (!success) {
        failedRequests.add(1);
        console.error(`❌ ${testName} failed: status ${response.status}, duration ${response.timings.duration}ms`);
        if (response.body) {
            try {
                console.error('Response body:', JSON.parse(response.body));
            } catch (e) {
                console.error('Response body:', response.body.substring(0, 200));
            }
        }
    }
    
    return success;
}

/**
 * Parse and validate JSON response
 */
export function parseJsonResponse(response, testName = 'request') {
    try {
        return JSON.parse(response.body);
    } catch (e) {
        console.error(`❌ ${testName}: Failed to parse JSON response`);
        console.error('Response body:', response.body.substring(0, 200));
        failedRequests.add(1);
        return null;
    }
}

/**
 * Get auth headers with JWT token
 */
export function getAuthHeaders(token) {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
}

/**
 * Log test progress
 */
export function logProgress(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
}

/**
 * Generate test summary
 */
export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'results/summary.json': JSON.stringify(data),
    };
}

/**
 * Test users credentials for load testing
 */
export const TEST_USERS = [
    { email: 'AHT@gmail.com', password: 'AHT@gmail.com' },
    // Add more test users as needed for parallel testing
];

/**
 * Get a test user (cycling through available users)
 */
export function getTestUser(vuId) {
    return TEST_USERS[vuId % TEST_USERS.length];
}

/**
 * Setup test data - should be called in setup() function
 */
export function setupTestData() {
    // This can be extended to create test data before tests run
    logProgress('Setting up test data...');
    return {
        baseUrl: BASE_URL,
        timestamp: Date.now(),
    };
}

/**
 * Teardown test data - should be called in teardown() function
 */
export function teardownTestData(data) {
    logProgress('Tearing down test data...', data);
    // Clean up test data if needed
}

/**
 * Wait for service to be ready
 */
export function waitForService(url, maxAttempts = 10, delaySeconds = 3) {
    logProgress(`Waiting for service at ${url}...`);
    
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = http.get(url);
            if (response.status === 200) {
                logProgress('Service is ready!');
                return true;
            }
        } catch (e) {
            // Service not ready yet
        }
        sleep(delaySeconds);
        logProgress(`Attempt ${i + 1}/${maxAttempts}...`);
    }
    
    logProgress('Service failed to become ready!');
    return false;
}

export default {
    randomInt,
    randomEmail,
    randomCompanyName,
    randomClientName,
    generateInvoiceData,
    thinkTime,
    checkResponse,
    parseJsonResponse,
    getAuthHeaders,
    logProgress,
    getTestUser,
    setupTestData,
    teardownTestData,
    waitForService,
    BASE_URL,
    TEST_USERS,
    // Metrics
    errorRate,
    loginDuration,
    apiRequestDuration,
    failedRequests,
};
