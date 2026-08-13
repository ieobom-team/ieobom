# PR 을 만들기 전에 실행한다. 아직 생성되지 않은 앱은 SKIP 한다.
#
#   pwsh ./scripts/verify-before-pr.ps1
#
# JAVA_HOME 이 안 잡혀 있으면 흔한 설치 위치(JetBrains `.jdks` 등)에서 이 스크립트 실행
# 동안만 자동으로 찾아 채운다. 못 찾으면 아래처럼 직접 설정한 뒤 다시 실행한다. 예)
#   $env:JAVA_HOME = "$env:USERPROFILE\.jdks\temurin-21.0.10"

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$failed = 0

function Section($t) { Write-Host "`n== $t" -ForegroundColor White }
function Ok($t)      { Write-Host "   OK - $t"   -ForegroundColor Green }
function Skip($t)    { Write-Host "   SKIP - $t" -ForegroundColor DarkGray }
function Fail($t)    { Write-Host "   FAIL - $t" -ForegroundColor Red; $script:failed = 1 }
function Info($t)    { Write-Host "   $t" -ForegroundColor DarkGray }

# apps/api 의 gradle toolchain 이 Java 21 을 요구한다(build.gradle). JAVA_HOME 이 없으면
# gradlew.bat 자체가 뜨지 못하므로, 이미 잡혀 있거나 PATH 에 java 가 있으면 그대로 두고
# 없을 때만 흔한 설치 위치를 뒤져 이 프로세스 동안만 $env:JAVA_HOME 을 채운다.
# 사용자의 인터랙티브 셸 환경은 건드리지 않는다(pwsh 로 새 프로세스에서 돈다).
function Resolve-JavaHome {
    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
        return $true
    }
    if (Get-Command java -ErrorAction SilentlyContinue) {
        return $true
    }

    $searchRoots = @(
        "$env:USERPROFILE\.jdks",
        "${env:ProgramFiles}\Eclipse Adoptium",
        "${env:ProgramFiles}\Java"
    )
    $candidates = foreach ($searchRoot in $searchRoots) {
        if (Test-Path $searchRoot) {
            Get-ChildItem $searchRoot -Directory -ErrorAction SilentlyContinue |
                Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') }
        }
    }
    if (-not $candidates) { return $false }

    # 21 이 이름에 들어간 걸 우선한다 (build.gradle 의 toolchain 이 21 을 요구)
    $picked = $candidates | Where-Object { $_.Name -match '21' } | Select-Object -First 1
    if (-not $picked) { $picked = $candidates | Select-Object -First 1 }
    $env:JAVA_HOME = $picked.FullName
    return $true
}

Section "backend (apps/api)"
if (Test-Path "$root\apps\api\gradlew.bat") {
    if (Resolve-JavaHome) {
        if ($env:JAVA_HOME) { Info "JAVA_HOME=$env:JAVA_HOME" }
        Push-Location "$root\apps\api"
        & .\gradlew.bat build --no-daemon --console=plain
        if ($LASTEXITCODE -eq 0) { Ok "gradlew build" } else { Fail "gradlew build" }
        Pop-Location
    } else {
        Fail "gradlew build (JDK 21 을 찾지 못했습니다 - 설치 후 JAVA_HOME 을 직접 설정해 주세요)"
    }
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
