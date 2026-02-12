// =============================================================================
// Spike Test - Sudden traffic surge
// =============================================================================
// Purpose: Test system behavior under sudden traffic spike (0→100→0 VUs)
// Run: k6 run load-testing/scenarios/spike-test.js
// =============================================================================

import http from 'k6/http';
import { sleep } from 'k6';
import { 
    BASE_URL, 
    getTestUser,
    getAuthHeaders,
    checkResponse,
    parseJsonResponse,
    thinkTime 
} from '../utils/common.js';

export const options = {
    stages: [
        { duration: '30s', target: 10 },   // Normal load
        { duration: '30s', target: 100 },  // SPIKE to 100 users!
        { duration: '2m', target: 100 },   // Hold spike
        { duration: '30s', target: 10 },   // Drop back to normal
        { duration: '30s', target: 0 },    // Cool down
    ],
    thresholds: {
        http_req_duration: ['p(95)<3000'], // Very lenient during spike
        http_req_failed: ['rate<0.15'], // Allow up to 15% failure during spike
        checks: ['rate>0.85'], // 85% of checks must pass
    },
    tags: {
        test_type: 'spike',
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
        sleep(3);
        return;
    }
    
    const loginData = parseJsonResponse(loginRes, 'Login');
    if (!loginData || !loginData.token) {
        sleep(3);
        return;
    }
    
    const authHeaders = getAuthHeaders(loginData.token);
    sleep(0.5);
    
    // =================================================================
    // 2. DASHBOARD STATS
    // =================================================================
    const dashboardRes = http.get(
        `${BASE_URL}/api/dashboard/stats`,
        {
            headers: authHeaders,
            tags: { name: 'Dashboard Stats' },
        }
    );
    
    checkResponse(dashboardRes, 200, 'Dashboard Stats');
    sleep(0.5);
    
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
    sleep(0.5);
    
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
    sleep(1);
}

export function handleSummary(data) {
    const summary = {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'load-testing/results/spike-test-summary.json': JSON.stringify(data, null, 2),
    };
    
    console.log('\n⚡ Spike Test Analysis:');
    console.log('   Check how the system recovered after the sudden spike.');
    console.log('   Look for error rate patterns during and after the spike.');
    
    return summary;
}
