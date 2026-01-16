#!/bin/bash

# Wizplay Production Service Management Script
# Quick commands for managing production services

set -e

case "${1:-help}" in
    "start")
        echo "🚀 Starting Wizplay production services..."
        docker-compose -f docker-compose.prod.yaml up -d
        echo "✅ Services started!"
        ;;
    "stop") 
        echo "🛑 Stopping Wizplay production services..."
        docker-compose -f docker-compose.prod.yaml down
        echo "✅ Services stopped!"
        ;;
    "restart")
        echo "🔄 Restarting Wizplay production services..."
        docker-compose -f docker-compose.prod.yaml down
        docker-compose -f docker-compose.prod.yaml up -d
        echo "✅ Services restarted!"
        ;;
    "status")
        echo "📊 Wizplay production services status:"
        docker-compose -f docker-compose.prod.yaml ps
        ;;
    "logs")
        service="${2:-}"
        if [ -z "$service" ]; then
            echo "📋 Showing logs for all services (press Ctrl+C to exit):"
            docker-compose -f docker-compose.prod.yaml logs -f
        else
            echo "📋 Showing logs for $service (press Ctrl+C to exit):"
            docker-compose -f docker-compose.prod.yaml logs -f "$service"
        fi
        ;;
    "update")
        echo "📦 Updating Wizplay production services..."
        docker-compose -f docker-compose.prod.yaml down
        docker-compose -f docker-compose.prod.yaml build
        docker-compose -f docker-compose.prod.yaml up -d
        echo "✅ Services updated!"
        ;;
    "help"|*)
        echo "🔧 Wizplay Production Service Manager"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  start     - Start all production services"
        echo "  stop      - Stop all production services"
        echo "  restart   - Restart all production services"
        echo "  status    - Show service status"
        echo "  logs      - Show logs (optionally specify service name)"
        echo "  update    - Rebuild and restart all services"
        echo "  help      - Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 start"
        echo "  $0 logs auth_service"
        echo "  $0 status"
        ;;
esac