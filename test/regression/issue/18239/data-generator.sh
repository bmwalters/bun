#!/bin/bash

# Test data generator script
# Sends data with delays to simulate real-time input

echo "Generating test data with 1s delay..."

for i in {1..3}; do
    echo "Line $i - $(date)"
    sleep 1
done

echo "All data sent!"
