// =============================================================================
// Soak Test - Extended endurance test (24 hours)
// =============================================================================
// Purpose: Detect memory leaks, resource exhaustion over long duration
// Run: k6 run load-testing/scenarios/soak-test.js
// Warning: This test runs for 24 hours! Use for production readiness only.
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
    thinkTime 
} from '../utils/common.js';

export const options = {
    stages: [
        { duration: '5m', target: 30 },      // Ramp up to 30 users
        { duration: '23h50m', target: 30 },  // Stay at 30 users for ~24 hours
        { duration: '5m', target: 0 },       // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'], 
        http_req_failed: ['rate<0.01'], 
        checks: ['rate>0.98'], 
    },
    tags: {
        test_type: 'soak',
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
        return;
    }
    
    const loginData = parseJsonResponse(loginRes, 'Login');
    if (!loginData || !loginData.token) {
        return;
    }
    
    const authHeaders = getAuthHeaders(loginData.token);
    thinkTime(2, 4);
    
    // =================================================================
    // 2. DASHBOARD
    // =================================================================
    const dashboardRes = http.get(
        `${BASE_URL}/api/dashboard/stats`,
        {
            headers: authHeaders,
            tags: { name: 'Dashboard Stats' },
        }
    );
    
    checkResponse(dashboardRes, 200, 'Dashboard Stats');
    thinkTime(2, 5);
    
    // =================================================================
    // 3. LIST INVOICES
    // =================================================================
    const invoicesRes = http.get(
        `${BASE_URL}/api/invoices?page=${randomInt(1, 3)}&size=20`,
        {
            headers: authHeaders,
            tags: { name: 'List Invoices' },
        }
    );
    
    checkResponse(invoicesRes, 200, 'List Invoices');
    thinkTime(3, 6);
    
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
        // 5. CREATE INVOICE (10% probability to avoid data bloat)
        // =================================================================
        if (clientsData && clientsData.length > 0 && Math.random() < 0.1) {
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
    
    thinkTime(5, 10);
    
    // =================================================================
    // 6. REVENUE SUMMARY (occasional)
    // =================================================================
    if (Math.random() < 0.15) {
        const revenueSummaryRes = http.get(
            `${BASE_URL}/api/dashboard/revenue-summary`,
            {
                headers: authHeaders,
                tags: { name: 'Revenue Summary' },
            }
        );
        
        checkResponse(revenueSummaryRes, 200, 'Revenue Summary');
        thinkTime(4, 8);
    }
    
    // Longer think time for soak test (simulate real user behavior)
    thinkTime(10, 20);
}

export function handleSummary(data) {
    const summary = {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'load-testing/results/soak-test-summary.json': JSON.stringify(data, null, 2),
    };
    
    console.log('\n🔋 Soak Test Analysis:');
    console.log('   Monitor for memory growth over time.');
    console.log('   Check if response times degraded gradually.');
    console.log('   Verify no resource leaks (DB connections, file handles, etc.)');
    
    const p95Start = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
    console.log(`   P95 Duration: ${p95Start.toFixed(2)}ms`);
    console.log('   Compare this with P95 at the beginning of the test.');
    
    return summary;
}
