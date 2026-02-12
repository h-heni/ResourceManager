// =============================================================================
// Smoke Test - Verify all critical endpoints are working
// =============================================================================
// Purpose: Quick sanity check with minimal load (1-5 VUs for 2 minutes)
// Run: k6 run load-testing/scenarios/smoke-test.js
// =============================================================================

import http from 'k6/http';
import { sleep } from 'k6';
import { 
    BASE_URL, 
    getTestUser,
    getAuthHeaders,
    checkResponse,
    parseJsonResponse,
    thinkTime,
    logProgress 
} from '../utils/common.js';

export const options = {
    vus: 5, // 5 concurrent virtual users
    duration: '2m', // Run for 2 minutes
    thresholds: {
        http_req_duration: ['p(95)<1000'], // 95% of requests must complete below 1s
        http_req_failed: ['rate<0.05'], // Less than 5% of requests can fail
        checks: ['rate>0.95'], // 95% of checks must pass
    },
    tags: {
        test_type: 'smoke',
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
        return; // Stop this iteration if login fails
    }
    
    const loginData = parseJsonResponse(loginRes, 'Login');
    if (!loginData || !loginData.token) {
        logProgress('❌ Login response missing token');
        return;
    }
    
    const authHeaders = getAuthHeaders(loginData.token);
    thinkTime(1, 2);
    
    // =================================================================
    // 2. GET DASHBOARD STATS
    // =================================================================
    const dashboardRes = http.get(
        `${BASE_URL}/api/dashboard/stats`,
        {
            headers: authHeaders,
            tags: { name: 'Dashboard Stats' },
        }
    );
    
    checkResponse(dashboardRes, 200, 'Dashboard Stats');
    thinkTime();
    
    // =================================================================
    // 3. LIST INVOICES (paginated)
    // =================================================================
    const invoicesRes = http.get(
        `${BASE_URL}/api/invoices?page=1&size=20`,
        {
            headers: authHeaders,
            tags: { name: 'List Invoices' },
        }
    );
    
    checkResponse(invoicesRes, 200, 'List Invoices');
    thinkTime();
    
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
    
    checkResponse(clientsRes, 200, 'List Clients');
    thinkTime();
    
    // =================================================================
    // 5. GET COMPANY INFO
    // =================================================================
    const companyRes = http.get(
        `${BASE_URL}/api/company/my`,
        {
            headers: authHeaders,
            tags: { name: 'Get Company' },
        }
    );
    
    checkResponse(companyRes, 200, 'Get Company');
    thinkTime();
    
    // =================================================================
    // 6. LIST DEVIS (Quotes)
    // =================================================================
    const devisRes = http.get(
        `${BASE_URL}/api/devis?page=1&size=20`,
        {
            headers: authHeaders,
            tags: { name: 'List Devis' },
        }
    );
    
    checkResponse(devisRes, 200, 'List Devis');
    thinkTime(2, 3);
}

export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'load-testing/results/smoke-test-summary.json': JSON.stringify(data, null, 2),
    };
}
