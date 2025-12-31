# ============================================================
# LifeFlow Azure Deployment Script
# ============================================================

# Configuratie
$ResourceGroup = "lifeflow-rg"
$Location = "westeurope"
$AppName = "lifeflow"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  LifeFlow Azure Deployment" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Resource Group aanmaken
Write-Host "[1/6] Resource Group aanmaken..." -ForegroundColor Yellow
az group create --name $ResourceGroup --location $Location --output none
Write-Host "  ✓ Resource Group: $ResourceGroup" -ForegroundColor Green

# 2. PostgreSQL Flexible Server
Write-Host "`n[2/6] PostgreSQL database aanmaken..." -ForegroundColor Yellow
$DbServer = "$AppName-db"
$DbPassword = "Lifeflow2025!" # Wijzig dit in productie!
$DbName = "lifeflow"

az postgres flexible-server create `
    --resource-group $ResourceGroup `
    --name $DbServer `
    --location $Location `
    --admin-user lifeflowadmin `
    --admin-password $DbPassword `
    --sku-name Standard_B1ms `
    --tier Burstable `
    --storage-size 32 `
    --version 16 `
    --yes `
    --output none

Write-Host "  ✓ PostgreSQL Server: $DbServer" -ForegroundColor Green

# Database aanmaken
az postgres flexible-server db create `
    --resource-group $ResourceGroup `
    --server-name $DbServer `
    --database-name $DbName `
    --output none

Write-Host "  ✓ Database: $DbName" -ForegroundColor Green

# Firewall regel voor Azure services
az postgres flexible-server firewall-rule create `
    --resource-group $ResourceGroup `
    --name $DbServer `
    --rule-name AllowAzureServices `
    --start-ip-address 0.0.0.0 `
    --end-ip-address 0.0.0.0 `
    --output none

Write-Host "  ✓ Firewall configured" -ForegroundColor Green

# 3. Container Registry
Write-Host "`n[3/6] Container Registry aanmaken..." -ForegroundColor Yellow
$AcrName = "lifeflowacr$(Get-Random -Maximum 9999)"

az acr create `
    --resource-group $ResourceGroup `
    --name $AcrName `
    --sku Basic `
    --admin-enabled true `
    --output none

Write-Host "  ✓ Container Registry: $AcrName" -ForegroundColor Green

# 4. Container Apps Environment
Write-Host "`n[4/6] Container Apps Environment aanmaken..." -ForegroundColor Yellow
$EnvName = "$AppName-env"

az containerapp env create `
    --resource-group $ResourceGroup `
    --name $EnvName `
    --location $Location `
    --output none

Write-Host "  ✓ Environment: $EnvName" -ForegroundColor Green

# 5. Build en push Docker image
Write-Host "`n[5/6] Docker image bouwen en pushen..." -ForegroundColor Yellow

# Login naar ACR
az acr login --name $AcrName

# Build met ACR
az acr build `
    --registry $AcrName `
    --image lifeflow:v1 `
    --file Dockerfile `
    . 

Write-Host "  ✓ Image gebouwd: $AcrName.azurecr.io/lifeflow:v1" -ForegroundColor Green

# 6. Container App deployen
Write-Host "`n[6/6] Container App deployen..." -ForegroundColor Yellow

$AcrPassword = $(az acr credential show --name $AcrName --query "passwords[0].value" -o tsv)
$DbHost = "$DbServer.postgres.database.azure.com"
$DatabaseUrl = "postgresql://lifeflowadmin:$DbPassword@${DbHost}:5432/$DbName?sslmode=require"
$NextAuthSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

az containerapp create `
    --resource-group $ResourceGroup `
    --name $AppName `
    --environment $EnvName `
    --image "$AcrName.azurecr.io/lifeflow:v1" `
    --registry-server "$AcrName.azurecr.io" `
    --registry-username $AcrName `
    --registry-password $AcrPassword `
    --target-port 3000 `
    --ingress external `
    --min-replicas 1 `
    --max-replicas 3 `
    --cpu 0.5 `
    --memory 1.0Gi `
    --env-vars "DATABASE_URL=$DatabaseUrl" "NEXTAUTH_SECRET=$NextAuthSecret" "NEXTAUTH_URL=https://$AppName.westeurope.azurecontainerapps.io" `
    --output none

# Get URL
$AppUrl = $(az containerapp show --resource-group $ResourceGroup --name $AppName --query "properties.configuration.ingress.fqdn" -o tsv)

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  ✅ DEPLOYMENT COMPLEET!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  🌐 App URL: https://$AppUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  📦 Resources:" -ForegroundColor White
Write-Host "     - Resource Group: $ResourceGroup"
Write-Host "     - PostgreSQL: $DbServer.postgres.database.azure.com"
Write-Host "     - Container Registry: $AcrName.azurecr.io"
Write-Host "     - Container App: $AppName"
Write-Host ""
Write-Host "  🔐 Database credentials:" -ForegroundColor White
Write-Host "     - Host: $DbHost"
Write-Host "     - Database: $DbName"
Write-Host "     - User: lifeflowadmin"
Write-Host "     - Password: $DbPassword"
Write-Host ""
Write-Host "  📱 iOS App API endpoint:" -ForegroundColor Yellow
Write-Host "     https://$AppUrl/api" -ForegroundColor Cyan
Write-Host ""

# Save credentials
$CredsFile = "azure-credentials.txt"
@"
LifeFlow Azure Deployment
=========================
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm')

App URL: https://$AppUrl
API Endpoint: https://$AppUrl/api

Database:
  Host: $DbHost
  Database: $DbName
  User: lifeflowadmin
  Password: $DbPassword
  Connection: $DatabaseUrl

Container Registry:
  Server: $AcrName.azurecr.io
  Username: $AcrName
  Password: $AcrPassword
"@ | Out-File -FilePath $CredsFile -Encoding utf8

Write-Host "  💾 Credentials opgeslagen in: $CredsFile" -ForegroundColor Yellow
