#!/bin/bash

# Test script for all_users broadcast notifications

echo "Testing broadcast notification to all users..."

curl -X POST http://localhost:4007/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "recipientType": "all_users",
    "title": "System Announcement", 
    "body": "This is a broadcast message to all users",
    "type": "system"
  }'

echo -e "\n\nBroadcast test completed. Check the response above."