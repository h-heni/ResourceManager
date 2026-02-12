# Load testing results will be saved here

This directory contains test results from k6 load tests.

Results are automatically generated when you run tests:
- `smoke-test-summary.json`
- `load-test-summary.json`
- `stress-test-summary.json`
- `spike-test-summary.json`
- `soak-test-summary.json`

View results with:
```bash
cat load-testing/results/load-test-summary.json | jq
```
