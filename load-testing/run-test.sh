#!/bin/bash
# =============================================================================
# K6 Load Testing Runner Script
# =============================================================================
# Usage: ./run-test.sh [test-type]
# Examples:
#   ./run-test.sh smoke
#   ./run-test.sh load
#   ./run-test.sh stress
#   ./run-test.sh spike
#   ./run-test.sh soak
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RESULTS_DIR="$SCRIPT_DIR/results"
API_URL="${API_URL:-http://localhost:7175}"

# Create results directory
mkdir -p "$RESULTS_DIR"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if k6 is installed
check_k6() {
    if ! command -v k6 &> /dev/null; then
        print_error "k6 is not installed!"
        echo ""
        echo "Install k6:"
        echo "  macOS:    brew install k6"
        echo "  Linux:    See https://k6.io/docs/getting-started/installation/"
        echo "  Docker:   docker pull grafana/k6:latest"
        exit 1
    fi
    print_success "k6 is installed: $(k6 version)"
}

# Function to check if API is running
check_api() {
    print_info "Checking if API is available at $API_URL..."
    
    if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
        print_success "API is running at $API_URL"
        return 0
    else
        print_warning "API is not responding at $API_URL"
        print_info "Start the application with: docker compose up -d"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Function to run a specific test
run_test() {
    local test_type=$1
    local scenario_file="$SCRIPT_DIR/scenarios/${test_type}-test.js"
    
    if [ ! -f "$scenario_file" ]; then
        print_error "Test scenario not found: $scenario_file"
        exit 1
    fi
    
    print_info "Running $test_type test..."
    echo ""
    
    # Run k6 with output to console and JSON
    local result_file="$RESULTS_DIR/${test_type}-test-$(date +%Y%m%d-%H%M%S).json"
    
    API_URL="$API_URL" k6 run \
        --out json="$result_file" \
        "$scenario_file"
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        print_success "Test completed successfully!"
        print_info "Results saved to: $result_file"
    else
        print_error "Test failed with exit code: $exit_code"
    fi
    
    return $exit_code
}

# Function to show usage
show_usage() {
    echo ""
    echo "Usage: $0 [test-type]"
    echo ""
    echo "Available test types:"
    echo "  smoke    - Quick sanity check (2 min, 1-5 VUs)"
    echo "  load     - Normal load simulation (10 min, 10-50 VUs)"
    echo "  stress   - Find breaking point (15 min, 50-200 VUs)"
    echo "  spike    - Sudden traffic surge (5 min, 0→100→0 VUs)"
    echo "  soak     - 24-hour endurance test (30 VUs)"
    echo ""
    echo "Examples:"
    echo "  $0 smoke"
    echo "  $0 load"
    echo "  API_URL=http://myapi.com:8080 $0 stress"
    echo ""
}

# Main script
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║         ResourceManager Load Testing with k6              ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Check arguments
    if [ $# -eq 0 ]; then
        print_error "No test type specified!"
        show_usage
        exit 1
    fi
    
    local test_type=$1
    
    # Validate test type
    case "$test_type" in
        smoke|load|stress|spike|soak)
            ;;
        *)
            print_error "Invalid test type: $test_type"
            show_usage
            exit 1
            ;;
    esac
    
    # Pre-flight checks
    check_k6
    check_api
    
    echo ""
    print_info "Test Configuration:"
    echo "  Test Type: $test_type"
    echo "  API URL:   $API_URL"
    echo "  Results:   $RESULTS_DIR"
    echo ""
    
    # Confirm for long-running tests
    if [ "$test_type" = "soak" ]; then
        print_warning "Soak test runs for 24 hours!"
        read -p "Are you sure you want to continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Test cancelled"
            exit 0
        fi
    fi
    
    # Run the test
    run_test "$test_type"
    
    echo ""
    print_info "Next steps:"
    echo "  1. Review the test results above"
    echo "  2. Check detailed JSON output: $RESULTS_DIR/"
    echo "  3. Monitor system resources: docker stats"
    echo "  4. Analyze bottlenecks: see load-testing/README.md"
    echo ""
}

# Run main function
main "$@"
