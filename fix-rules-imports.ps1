# Fix Rules Engine Import Paths
# Run from: C:\Users\johan\Projects\lifeflow-azure

$projectPath = "C:\Users\johan\Projects\lifeflow-azure"
Set-Location $projectPath

Write-Host "Fixing Rules Engine import paths..." -ForegroundColor Cyan

# Fix index.ts - alle imports moeten naar ../../types/rules
$indexPath = "src/lib/rules-engine/index.ts"
$indexContent = @'
// LifeFlow AI Rules Engine - Main Export
// src/lib/rules-engine/index.ts

// Types
export * from '../../types/rules';

// Core modules
export { anonymizeEmail, anonymizeEmails, extractEmailData } from './email-anonymizer';
export { classifyEmailWithTrustAI, classifyEmailLocally, testTrustAIConnection } from './trustai-client';
export { shouldTrigger, executeAction, executeMatchingRules } from './rule-executor';
export { fetchGmailEmails, markAsRead, addLabel, getGmailProfile, refreshAccessToken } from './gmail-client';
export { processNewEmails, testEmailProcessing, getProcessingStats } from './email-processor';
'@
Set-Content -Path $indexPath -Value $indexContent -Encoding UTF8
Write-Host "  Fixed: $indexPath" -ForegroundColor Green

# Fix email-anonymizer.ts
$anonymizerPath = "src/lib/rules-engine/email-anonymizer.ts"
$content = Get-Content $anonymizerPath -Raw
$content = $content -replace "from '../types/rules'", "from '../../types/rules'"
Set-Content -Path $anonymizerPath -Value $content -Encoding UTF8
Write-Host "  Fixed: $anonymizerPath" -ForegroundColor Green

# Fix trustai-client.ts
$trustaiPath = "src/lib/rules-engine/trustai-client.ts"
$content = Get-Content $trustaiPath -Raw
$content = $content -replace "from '../types/rules'", "from '../../types/rules'"
Set-Content -Path $trustaiPath -Value $content -Encoding UTF8
Write-Host "  Fixed: $trustaiPath" -ForegroundColor Green

# Fix rule-executor.ts
$executorPath = "src/lib/rules-engine/rule-executor.ts"
$content = Get-Content $executorPath -Raw
$content = $content -replace "from '../types/rules'", "from '../../types/rules'"
Set-Content -Path $executorPath -Value $content -Encoding UTF8
Write-Host "  Fixed: $executorPath" -ForegroundColor Green

# Fix gmail-client.ts
$gmailPath = "src/lib/rules-engine/gmail-client.ts"
$content = Get-Content $gmailPath -Raw
$content = $content -replace "from '../types/rules'", "from '../../types/rules'"
Set-Content -Path $gmailPath -Value $content -Encoding UTF8
Write-Host "  Fixed: $gmailPath" -ForegroundColor Green

# Fix email-processor.ts
$processorPath = "src/lib/rules-engine/email-processor.ts"
$content = Get-Content $processorPath -Raw
$content = $content -replace "from '../types/rules'", "from '../../types/rules'"
Set-Content -Path $processorPath -Value $content -Encoding UTF8
Write-Host "  Fixed: $processorPath" -ForegroundColor Green

# Fix API routes - ze moeten @/lib/rules-engine gebruiken
$rulesRoutePath = "src/app/api/rules/route.ts"
$content = Get-Content $rulesRoutePath -Raw
$content = $content -replace "@/lib/rules-engine/email-processor", "@/lib/rules-engine"
$content = $content -replace "from '@/lib/rules-engine/email-processor'", "from '@/lib/rules-engine'"
Set-Content -Path $rulesRoutePath -Value $content -Encoding UTF8
Write-Host "  Fixed: $rulesRoutePath" -ForegroundColor Green

$processEmailsPath = "src/app/api/process-emails/route.ts"
$content = Get-Content $processEmailsPath -Raw
$content = $content -replace "@/lib/rules-engine/email-processor", "@/lib/rules-engine"
$content = $content -replace "from '@/lib/rules-engine/email-processor'", "from '@/lib/rules-engine'"
Set-Content -Path $processEmailsPath -Value $content -Encoding UTF8
Write-Host "  Fixed: $processEmailsPath" -ForegroundColor Green

$cronPath = "src/app/api/cron/route.ts"
$content = Get-Content $cronPath -Raw
$content = $content -replace "@/lib/rules-engine/email-processor", "@/lib/rules-engine"
$content = $content -replace "from '@/lib/rules-engine/email-processor'", "from '@/lib/rules-engine'"
Set-Content -Path $cronPath -Value $content -Encoding UTF8
Write-Host "  Fixed: $cronPath" -ForegroundColor Green

Write-Host "`nAll imports fixed!" -ForegroundColor Green
Write-Host "Restart your dev server: npm run dev" -ForegroundColor Yellow
