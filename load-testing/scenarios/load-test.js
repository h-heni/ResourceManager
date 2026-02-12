// =============================================================================
// Load Test - Simulate realistic normal usage
// =============================================================================
// Purpose: Test system under expected production load (10-50 VUs for 10 minutes)
// Run: k6 run load-testing/scenarios/load-test.js
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
    randomClientName,
    randomInt,
    thinkTime,
    logProgress 
} from '../utils/common.js';

export const options = {
    stages: [
        { duration: '2m', target: 10 },  // Ramp up to 10 users
        { duration: '5m', target: 50 },  // Ramp up to 50 users
        { duration: '2m', target: 50 },  // Stay at 50 users
        { duration: '1m', target: 0 },   // Ramp down to 0 users
    ],
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
        http_req_failed: ['rate<0.01'], // Less than 1% of requests can fail
        checks: ['rate>0.98'], // 98% of checks must pass
    },
    tags: {
        test_type: 'load',
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
    thinkTime(1, 3);
    
    // =================================================================
    // 2. VIEW DASHBOARD
    // =================================================================
    const dashboardRes = http.get(
        `${BASE_URL}/api/dashboard/stats`,
        {
            headers: authHeaders,
            tags: { name: 'Dashboard Stats' },
        }
    );
    
    checkResponse(dashboardRes, 200, 'Dashboard Stats');
    thinkTime(2, 4);
    
    // =================================================================
    // 3. BROWSE INVOICES (multiple pages)
    // =================================================================
    for (let page = 1; page <= randomInt(1, 3); page++) {
        const invoicesRes = http.get(
            `${BASE_URL}/api/invoices?page=${page}&size=20`,
            {
                headers: authHeaders,
                tags: { name: 'List Invoices' },
            }
        );
        
        checkResponse(invoicesRes, 200, `List Invoices (Page ${page})`);
        thinkTime(1, 3);
    }
    
    // =================================================================
    // 4. GET CLIENTS
    // =================================================================
    const clientsRes = http.get(
        `${BASE_URL}/api/clients`,
        {
            headers: authHeaders,
            tags: { name: 'List Clients' },
        }
    );
    
    if (!checkResponse(clientsRes, 200, 'List Clients')) {
        return;
    }
    
    const clientsData = parseJsonResponse(clientsRes, 'List Clients');
    thinkTime(2, 4);
    
    // =================================================================
    // 5. CREATE OR VIEW CLIENT
    // =================================================================
    let clientId = null;
    
    if (clientsData && clientsData.length > 0) {
        // Use existing client
        clientId = clientsData[randomInt(0, Math.min(clientsData.length - 1, 10))].id;
        
        // View client details
        const clientDetailsRes = http.get(
            `${BASE_URL}/api/clients/${clientId}`,
            {
                headers: authHeaders,
                tags: { name: 'Get Client Details' },
            }
        );
        
        checkResponse(clientDetailsRes, 200, 'Get Client Details');
    } else {
        // Create new client if none exist
        const newClientPayload = JSON.stringify({
            name: randomClientName(),
            email: `client_${Date.now()}@example.com`,
            phone: '+1234567890',
            address: '123 Main St',
        });
        
        const createClientRes = http.post(
            `${BASE_URL}/api/clients`,
            newClientPayload,
            {
                headers: authHeaders,
                tags: { name: 'Create Client' },
            }
        );
        
        if (checkResponse(createClientRes, 200, 'Create Client')) {
            const newClient = parseJsonResponse(createClientRes, 'Create Client');
            clientId = newClient?.id;
        }
    }
    
    thinkTime(2, 5);
    
    // =================================================================
    // 6. CREATE INVOICE (30% probability)
    // =================================================================
    if (clientId && Math.random() < 0.3) {
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
        
        if (checkResponse(createInvoiceRes, 200, 'Create Invoice')) {
            const newInvoice = parseJsonResponse(createInvoiceRes, 'Create Invoice');
            
            if (newInvoice && newInvoice.id) {
                thinkTime(1, 2);
                
                // Generate PDF for the new invoice
                const pdfRes = http.get(
                    `${BASE_URL}/api/invoices/${newInvoice.id}/pdf`,
                    {
                        headers: authHeaders,
                        tags: { name: 'Generate PDF' },
                    }
                );
                
                checkResponse(pdfRes, 200, 'Generate PDF');
            }
        }
    }
    
    thinkTime(2, 5);
    
    // =================================================================
    // 7. VIEW REVENUE SUMMARY (20% probability)
    // =================================================================
    if (Math.random() < 0.2) {
        const revenueSummaryRes = http.get(
            `${BASE_URL}/api/dashboard/revenue-summary`,
            {
                headers: authHeaders,
                tags: { name: 'Revenue Summary' },
            }
        );
        
        checkResponse(revenueSummaryRes, 200, 'Revenue Summary');
        thinkTime(3, 6);
    }
    
    // =================================================================
    // 8. LIST DELIVERY NOTES (20% probability)
    // =================================================================
    if (Math.random() < 0.2) {
        const deliveryNotesRes = http.get(
            `${BASE_URL}/api/deliverynotes?page=1&size=20`,
            {
                headers: authHeaders,
                tags: { name: 'List Delivery Notes' },
            }
        );
        
        checkResponse(deliveryNotesRes, 200, 'List Delivery Notes');
        thinkTime(2, 4);
    }
    
    // Final think time before next iteration
    thinkTime(3, 7);
}

export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'load-testing/results/load-test-summary.json': JSON.stringify(data, null, 2),
    };
}
