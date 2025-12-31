# ============================================================
# LifeFlow - Redeploy Script
# Gebruik dit script om updates te deployen
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LifeFlow Redeploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ExtractPath = "C:\Users\johan\Projects\lifeflow-azure"
$ResourceGroup = "lifeflow-rg"
$AppName = "lifeflow"
$AcrName = "lifeflowacr5207"

Set-Location $ExtractPath
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Green

# 1. Genereer package-lock als nodig
if (-not (Test-Path "package-lock.json")) {
    Write-Host ""
    Write-Host "[1/3] package-lock.json genereren..." -ForegroundColor Yellow
    npm install --package-lock-only
}

# 2. Build nieuwe Docker image
Write-Host ""
Write-Host "[2/3] Docker image bouwen (v2)..." -ForegroundColor Yellow

$version = "v" + (Get-Date -Format "yyyyMMdd-HHmm")
az acr build --registry $AcrName --image "lifeflow:$version" --file Dockerfile .

if ($LASTEXITCODE -ne 0) {
    Write-Host "  FOUT - Docker build mislukt!" -ForegroundColor Red
    exit 1
}
Write-Host "  OK - Image: $AcrName.azurecr.io/lifeflow:$version" -ForegroundColor Green

# 3. Update Container App
Write-Host ""
Write-Host "[3/3] Container App updaten..." -ForegroundColor Yellow

az containerapp update `
    --resource-group $ResourceGroup `
    --name $AppName `
    --image "$AcrName.azurecr.io/lifeflow:$version"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  FOUT - Update mislukt!" -ForegroundColor Red
    exit 1
}

$AppUrl = $(az containerapp show --resource-group $ResourceGroup --name $AppName --query "properties.configuration.ingress.fqdn" -o tsv)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  REDEPLOY COMPLEET!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Version: $version" -ForegroundColor Cyan
Write-Host "  URL: https://$AppUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Test de API:" -ForegroundColor Yellow
Write-Host "  - Health: https://$AppUrl/api/health"
Write-Host "  - Tasks:  https://$AppUrl/api/tasks"
Write-Host "  - Events: https://$AppUrl/api/events"
Write-Host ""
