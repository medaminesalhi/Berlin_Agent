@echo off
cd /d "%~dp0"
docker compose -f docker-searxng/docker-compose.yml up -d
pause
