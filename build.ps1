# ALPHA&CO POS - Build Scripts
# Run with: .\build.ps1 <command>

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

$ErrorActionPreference = "Stop"

function Show-Help {
    Write-Host @"

  ALPHA&CO POS - Build System
  ===========================

  Commands:
    dev         Start development servers (backend + frontend)
    build       Build for web deployment
    desktop     Build Windows desktop application (.exe)
    portable    Build portable version
    docker      Build and start Docker containers
    clean       Clean build artifacts

  Examples:
    .\build.ps1 dev
    .\build.ps1 desktop
    .\build.ps1 docker

"@ -ForegroundColor Cyan
}

function Start-Dev {
    Write-Host "🚀 Starting development servers..." -ForegroundColor Green
    
    # Start backend
    Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn server:app --reload --host 0.0.0.0 --port 8001"
    
    # Wait a bit for backend
    Start-Sleep -Seconds 2
    
    # Start frontend
    Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd frontend; yarn start"
    
    Write-Host @"

  ✅ Development servers starting...
  
  Backend:  http://localhost:8001
  Frontend: http://localhost:3000

"@ -ForegroundColor Green
}

function Build-Web {
    Write-Host "📦 Building for web deployment..." -ForegroundColor Green
    
    Push-Location frontend
    yarn install
    yarn build
    Pop-Location
    
    Write-Host "✅ Build complete! Files in frontend/build/" -ForegroundColor Green
}

function Build-Desktop {
    Write-Host "🖥️ Building Windows desktop application..." -ForegroundColor Green
    
    Push-Location frontend
    
    # Backup web config
    if (Test-Path package.json) {
        Copy-Item package.json package.web.json -Force
    }
    
    # Switch to electron config
    Copy-Item package.electron.json package.json -Force
    
    # Install and build
    yarn install
    yarn electron:build:win
    
    # Restore web config
    if (Test-Path package.web.json) {
        Copy-Item package.web.json package.json -Force
    }
    
    Pop-Location
    
    Write-Host @"

  ✅ Desktop build complete!
  
  Installer: frontend/dist/ALPHA&CO POS Setup*.exe
  Portable:  frontend/dist/ALPHA&CO POS*.exe

"@ -ForegroundColor Green
}

function Build-Portable {
    Write-Host "📱 Building portable version..." -ForegroundColor Green
    Build-Desktop
    Write-Host "✅ Portable version is the .exe file without 'Setup' in the name" -ForegroundColor Green
}

function Build-Docker {
    Write-Host "🐳 Building Docker containers..." -ForegroundColor Green
    
    if (-not (Test-Path .env)) {
        Copy-Item .env.example .env
        Write-Host "⚠️  Created .env from template - please edit with your settings!" -ForegroundColor Yellow
    }
    
    docker-compose up -d --build
    
    Write-Host @"

  ✅ Docker containers started!
  
  Frontend: http://localhost
  Backend:  http://localhost:8000
  
  Useful commands:
    docker-compose logs -f      # View logs
    docker-compose down         # Stop containers
    docker-compose ps           # List containers

"@ -ForegroundColor Green
}

function Clean-Build {
    Write-Host "🧹 Cleaning build artifacts..." -ForegroundColor Green
    
    if (Test-Path frontend/build) { Remove-Item -Recurse -Force frontend/build }
    if (Test-Path frontend/dist) { Remove-Item -Recurse -Force frontend/dist }
    
    Write-Host "✅ Clean complete!" -ForegroundColor Green
}

# Main execution
switch ($Command.ToLower()) {
    "dev"      { Start-Dev }
    "build"    { Build-Web }
    "desktop"  { Build-Desktop }
    "portable" { Build-Portable }
    "docker"   { Build-Docker }
    "clean"    { Clean-Build }
    default    { Show-Help }
}
