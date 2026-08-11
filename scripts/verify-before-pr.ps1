# PR 을 만들기 전에 실행한다. 아직 생성되지 않은 앱은 SKIP 한다.
#
#   pwsh ./scripts/verify-before-pr.ps1
#
# JAVA_HOME 이 안 잡혀 있으면 먼저 설정한다. 예)
#   $env:JAVA_HOME = "$env:USERPROFILE\.jdks\temurin-21.0.10"

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$failed = 0

function Section($t) { Write-Host "`n== $t" -ForegroundColor White }
function Ok($t)      { Write-Host "   OK - $t"   -ForegroundColor Green }
function Skip($t)    { Write-Host "   SKIP - $t" -ForegroundColor DarkGray }
function Fail($t)    { Write-Host "   FAIL - $t" -ForegroundColor Red; $script:failed = 1 }

Section "backend (apps/api)"
if (Test-Path "$root\apps\api\gradlew.bat") {
    Push-Location "$root\apps\api"
    & .\gradlew.bat build --no-daemon --console=plain
    if ($LASTEXITCODE -eq 0) { Ok "gradlew build" } else { Fail "gradlew build" }
    Pop-Location
} else {
    Skip "apps/api 가 아직 없습니다"
}

Section "frontend (apps/web)"
if (Test-Path "$root\apps\web\package.json") {
    Push-Location "$root\apps\web"
    npm run lint
    if ($LASTEXITCODE -eq 0) { Ok "npm run lint" } else { Fail "npm run lint" }
    npm test
    if ($LASTEXITCODE -eq 0) { Ok "npm test" } else { Fail "npm test" }
    npm run build
    if ($LASTEXITCODE -eq 0) { Ok "npm run build" } else { Fail "npm run build" }
    Pop-Location
} else {
    Skip "apps/web 이 아직 없습니다 (apps/web/README.md 참고)"
}

Section "secrets"
$tracked = git -C $root ls-files
$leaks = $tracked | Where-Object { $_ -match '(^|/)\.env$|\.pem$|(^|/)id_rsa$' }
if ($leaks) {
    $leaks | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    Fail "비밀 파일이 추적되고 있습니다"
} else {
    Ok "추적된 비밀 파일 없음"
}

Write-Host ""
if ($failed -eq 0) {
    Write-Host "검증 통과. PR 을 만들어도 됩니다." -ForegroundColor Green
} else {
    Write-Host "검증 실패. 원인을 확인하고 고친 뒤 다시 실행하세요." -ForegroundColor Red
}
exit $failed
