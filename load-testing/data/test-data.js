# =============================================================================
# Test Data - Seed data for load testing
# =============================================================================
# This file contains sample data structures for testing

# Test Users (add more for parallel load testing)
export const TEST_USERS = [
    {
        email: 'AHT@gmail.com',
        password: 'AHT@gmail.com',
        companyId: 1,
        companyName: 'Default Test Company'
    },
    # Add more test users here as needed:
    # {
    #     email: 'testuser2@example.com',
    #     password: 'securepassword2',
    #     companyId: 2,
    #     companyName: 'Test Company 2'
    # },
];

# Sample Client Names
export const CLIENT_NAMES = [
    'Acme Corporation',
    'TechStart Inc.',
    'Global Solutions Ltd.',
    'Innovation Partners',
    'Digital Ventures',
    'Smart Systems Co.',
    'Future Technologies',
    'Prime Industries',
    'Apex Consulting',
    'Quantum Services',
    'Nexus Group',
    'Stellar Enterprises',
    'Horizon Solutions',
    'Velocity Systems',
    'Phoenix Innovations',
];

# Sample Product/Service Descriptions
export const PRODUCT_DESCRIPTIONS = [
    'Web Development Services',
    'Mobile App Development',
    'Cloud Infrastructure Setup',
    'Database Optimization',
    'API Integration Services',
    'Security Audit & Consulting',
    'DevOps Implementation',
    'UI/UX Design Services',
    'Technical Consulting',
    'Software Maintenance',
    'Project Management',
    'Quality Assurance Testing',
    'Performance Optimization',
    'Data Migration Services',
    'Training & Documentation',
];

# Load Testing Scenarios Configuration
export const SCENARIOS = {
    smoke: {
        name: 'Smoke Test',
        duration: '2m',
        vus: 5,
        description: 'Quick sanity check with minimal load'
    },
    load: {
        name: 'Load Test',
        duration: '10m',
        vus: 50,
        description: 'Normal expected production load'
    },
    stress: {
        name: 'Stress Test',
        duration: '15m',
        vusMax: 200,
        description: 'Find system breaking point'
    },
    spike: {
        name: 'Spike Test',
        duration: '5m',
        vusMax: 100,
        description: 'Sudden traffic surge'
    },
    soak: {
        name: 'Soak Test',
        duration: '24h',
        vus: 30,
        description: 'Detect memory leaks over extended period'
    }
};

# Performance Thresholds
export const THRESHOLDS = {
    production: {
        p95_duration_ms: 500,
        p99_duration_ms: 1000,
        error_rate_percent: 1,
        checks_pass_rate_percent: 98
    },
    acceptable: {
        p95_duration_ms: 1000,
        p99_duration_ms: 2000,
        error_rate_percent: 5,
        checks_pass_rate_percent: 95
    },
    stress: {
        p95_duration_ms: 2000,
        p99_duration_ms: 5000,
        error_rate_percent: 10,
        checks_pass_rate_percent: 90
    }
};
