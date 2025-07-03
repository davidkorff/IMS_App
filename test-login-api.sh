#!/bin/bash

echo "Testing login API endpoint..."

# Try to login with a test request
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -v

echo -e "\n\nChecking server error logs..."