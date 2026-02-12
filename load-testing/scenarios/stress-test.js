// =============================================================================
// Stress Test - Find breaking point
// =============================================================================
// Purpose: Gradually increase load to find system limits (50-200 VUs over 15 minutes)
// Run: k6 run load-testing/scenarios/stress-test.js
// =============================================================================

import http from 'k6/http';
import { sleep } from 'k6';
import { 
    BASE_URL, 
    getTestUser,
    getAuthHeaders,
    checkResponse,
    parseJsonResponse,
    generateInvoiceData,
    randomInt,
    thinkTime,
    logProgress 
} from '../utils/common.js';

export const options = {
    stages: [
        { duration: '2m', target: 50 },   // Ramp up to 50 users
        { duration: '3m', target: 100 },  // Continue to 100 users
        { duration: '3m', target: 150 },  // Continue to 150 users
        { duration: '3m', target: 200 },  // Push to 200 users
        { duration: '2m', target: 200 },  // Stay at 200 users
        { duration: '2m', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'], // More lenient threshold
        http_req_failed: ['rate<0.10'], // Allow up to 10% failure at peak
        checks: ['rate>0.90'], // 90% of checks must pass
    },
    tags: {
        test_type: 'stress',
    },
};

export default function () {
    const user = getTestUser(__VU);
    
    // =================================================================
    // 1. LOGIN
    // =================================================================
    const loginPayload = JSON.stringify({
        email: user.email,
        password: user.password
    });
    
    const loginRes = http.post(
        `${BASE_URL}/api/auth/login`,
        loginPayload,
        {
            headers: { 'Content-Type': 'application/json' },
            tags: { name: 'Login' },
        }
    );
    
    if (!checkResponse(loginRes, 200, 'Login')) {
        sleep(5); // Back off on failure
        return;
    }
    
    const loginData = parseJsonResponse(loginRes, 'Login');
    if (!loginData || !loginData.token) {
        sleep(5);
        return;
    }
    
    const authHeaders = getAuthHeaders(loginData.token);
    thinkTime(0.5, 2);
    
    // =================================================================
    // 2. QUICK DASHBOARD CHECK
    // =================================================================
    const dashboardRes = http.get(
        `${BASE_URL}/api/dashboard/stats`,
        {
            headers: authHeaders,
            tags: { name: 'Dashboard Stats' },
        }
    );
    
    checkResponse(dashboardRes, 200, 'Dashboard Stats');
    thinkTime(0.5, 1.5);
    
    // =================================================================
    // 3. LIST INVOICES
    // =================================================================
    const invoicesRes = http.get(
        `${BASE_URL}/api/invoices?page=1&size=20`,
        {
            headers: authHeaders,
            tags: { name: 'List Invoices' },
        }
    );
    
    checkResponse(invoicesRes, 200, 'List Invoices');
    thinkTime(0.5, 1.5);
    
    // =================================================================
    // 4. LIST CLIENTS
    // =================================================================
    const clientsRes = http.get(
        `${BASE_URL}/api/clients`,
        {
            headers: authHeaders,
            tags: { name: 'List Clients' },
        }
    );
    
    if (checkResponse(clientsRes, 200, 'List Clients')) {
        const clientsData = parseJsonResponse(clientsRes, 'List Clients');
        
        // =================================================================
        // 5. CREATE INVOICE (if clients exist)
        // =================================================================
        if (clientsData && clientsData.length > 0) {
            const clientId = clientsData[randomInt(0, Math.min(clientsData.length - 1, 10))].id;
            const invoiceData = generateInvoiceData(clientId);
            const createInvoicePayload = JSON.stringify(invoiceData);
            
            const createInvoiceRes = http.post(
                `${BASE_URL}/api/invoices`,
                createInvoicePayload,
                {
                    headers: authHeaders,
                    tags: { name: 'Create Invoice' },
                }
            );
            
            checkResponse(createInvoiceRes, 200, 'Create Invoice');
        }
    }
    
    thinkTime(1, 3);
}

export function handleSummary(data) {
    const summary = {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'load-testing/results/stress-test-summary.json': JSON.stringify(data, null, 2),
    };
    
    // Log breaking point information
    const failureRate = data.metrics.http_req_failed?.values?.rate || 0;
    const p95Duration = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
    
    console.log('\n📊 Stress Test Analysis:');
    console.log(`   Failure Rate: ${(failureRate * 100).toFixed(2)}%`);
    console.log(`   P95 Duration: ${p95Duration.toFixed(2)}ms`);
    
    if (failureRate > 0.05) {
        console.log('   ⚠️  System showed signs of stress (>5% failure rate)');
    }
    if (p95Duration > 1000) {
        console.log('   ⚠️  Response times degraded significantly (P95 > 1s)');
    }
    
    return summary;
}
