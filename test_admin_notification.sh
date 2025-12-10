#!/bin/bash

# Test script to verify admin notification types work
# This sends a test notification with "success" type to verify the enum is working

echo "Testing admin notification with 'success' type..."

curl -X POST http://localhost:4007/api/v1/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "recipientType": "phone",
    "recipientValue": "8889689990", 
    "title": "Test Success Notification",
    "body": "This is a test notification with success type",
    "type": "success"
  }'

echo -e "\n\nTest completed. Check the response above."