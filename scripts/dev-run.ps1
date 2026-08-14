# 로컬 개발 환경 통합 실행 스크립트 (DB + Backend + Frontend)
#
#   pwsh ./scripts/dev-run.ps1

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot

function Section($t) { Write-Host "`n== $t" -ForegroundColor White }
function Ok($t)      { Write-Host "   OK - $t"   -ForegroundColor Green }
function Warn($t)    { Write-Host "   WARN - $t" -ForegroundColor Yellow }
function Fail($t)    { Write-Host "   FAIL - $t" -ForegroundColor Red }
function Info($t)    { Write-Host "   $t" -ForegroundColor DarkGray }

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

    $picked = $candidates | Where-Object { $_.Name -match '21' } | Select-Object -First 1
    if (-not $picked) { $picked = $candidates | Select-Object -First 1 }
    $env:JAVA_HOME = $picked.FullName
    return $true
}

# .env 파일이 있으면 환경변수로 로드 (키 값은 노출하지 않음)
if (Test-Path "$root\.env") {
    Get-Content "$root\.env" | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line -split "=", 2
            $key = $parts[0].Trim()
            $val = $parts[1].Trim().Trim('"', "'")
            if ($key -match '^[a-zA-Z_][a-zA-Z0-9_]*$') {
                [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
                Set-Item -Path "env:$key" -Value $val
            }
        }
    }
}

# 기본 DB 환경변수 설정 (미정의 시)
if (-not $env:MYSQL_DATABASE) { $env:MYSQL_DATABASE = "ieobom" }
if (-not $env:MYSQL_USER) { $env:MYSQL_USER = "ieobom" }
if (-not $env:MYSQL_PASSWORD) { $env:MYSQL_PASSWORD = "ieobom" }
if (-not $env:MYSQL_ROOT_PASSWORD) { $env:MYSQL_ROOT_PASSWORD = "root" }
if (-not $env:DB_URL) { $env:DB_URL = "jdbc:mysql://localhost:3306/ieobom?characterEncoding=UTF-8&serverTimezone=Asia/Seoul" }
if (-not $env:DB_USERNAME) { $env:DB_USERNAME = "ieobom" }
if (-not $env:DB_PASSWORD) { $env:DB_PASSWORD = "ieobom" }

# 1. DB 기동
Section "1. 데이터베이스(MySQL) 기동"
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker info >$null 2>&1
    if ($LASTEXITCODE -ne 0) {
        $dockerExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dockerExe) {
            Write-Host "   Docker Desktop이 꺼져 있어 자동으로 실행합니다..." -ForegroundColor Yellow
            Start-Process $dockerExe
            Write-Host -NoNewline "   Docker 시작 대기 중"
            for ($i = 0; $i -lt 20; $i++) {
                docker info >$null 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Host ""
                    break
                }
                Write-Host -NoNewline "."
                Start-Sleep -Seconds 2
            }
        }
    }

    docker info >$null 2>&1
    if ($LASTEXITCODE -eq 0) {
        Push-Location $root
        docker compose up -d
        Pop-Location
        Ok "MySQL 컨테이너가 실행 중입니다."
        Start-Sleep -Seconds 3
    } else {
        Warn "Docker 데몬이 실행 중이지 않습니다. Docker Desktop을 켜주세요."
    }
} else {
    Warn "docker 명령을 찾을 수 없습니다. DB가 이미 실행 중인지 확인하세요."
}

# 2. 백엔드 및 프론트엔드 기동
Section "2. 백엔드 및 프론트엔드 기동"
if (-not (Resolve-JavaHome)) {
    Fail "JDK 21을 찾지 못했습니다. JAVA_HOME을 설정해 주세요."
    exit 1
}
if ($env:JAVA_HOME) { Info "JAVA_HOME=$env:JAVA_HOME" }

if (-not (Test-Path "$root\apps\web\node_modules")) {
    Info "프론트엔드 의존성(npm install) 설치 중..."
    Push-Location "$root\apps\web"
    npm install
    Pop-Location
}

Write-Host "`n🚀 로컬 개발 환경을 기동합니다!" -ForegroundColor Green
Write-Host "   - 프론트엔드 접속 주소: http://localhost:5173" -ForegroundColor Cyan
Write-Host "   - 백엔드 API 주소:     http://localhost:8080"
Write-Host "   - 종료하려면 Ctrl + C 를 누르세요.`n" -ForegroundColor Yellow

$apiJob = Start-Job -ScriptBlock {
    param($cwd, $javaHome, $envFile)
    if ($javaHome) { $env:JAVA_HOME = $javaHome }
    if ($envFile -and (Test-Path $envFile)) {
        Get-Content $envFile | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $parts = $line -split "=", 2
                $k = $parts[0].Trim()
                $v = $parts[1].Trim().Trim('"', "'")
                if ($k -match '^[a-zA-Z_][a-zA-Z0-9_]*$') {
                    [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
                    Set-Item -Path "env:$k" -Value $v
                }
            }
        }
    }
    Set-Location $cwd
    .\gradlew.bat bootRun --console=plain
} -ArgumentList "$root\apps\api", $env:JAVA_HOME, "$root\.env"

$webJob = Start-Job -ScriptBlock {
    param($cwd)
    Set-Location $cwd
    npm run dev
} -ArgumentList "$root\apps\web"

try {
    while ($true) {
        Receive-Job $apiJob
        Receive-Job $webJob
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`n== 서버를 종료합니다..." -ForegroundColor Yellow
    Stop-Job $apiJob -ErrorAction SilentlyContinue
    Remove-Job $apiJob -ErrorAction SilentlyContinue
    Stop-Job $webJob -ErrorAction SilentlyContinue
    Remove-Job $webJob -ErrorAction SilentlyContinue
    Push-Location "$root\apps\api"
    .\gradlew.bat --stop >$null 2>&1
    Pop-Location
    Write-Host "== 백엔드/프론트엔드 개발 서버가 종료되었습니다." -ForegroundColor Green

    # Docker 및 WSL 종료 여부 확인
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        docker info >$null 2>&1
        if ($LASTEXITCODE -eq 0) {
            $ans = Read-Host "`nDocker DB 및 WSL을 완전히 종료하여 메모리(RAM)를 확보하시겠습니까? (y/N)"
            if ($ans -match '^[yY]') {
                Write-Host "   Docker 컨테이너 중지 중..." -ForegroundColor DarkGray
                Push-Location $root
                docker compose down
                Pop-Location
                if (Get-Command wsl -ErrorAction SilentlyContinue) {
                    Write-Host "   WSL 가상머신 종료 및 메모리 반환 중 (wsl --shutdown)..." -ForegroundColor DarkGray
                    wsl --shutdown
                }
                Write-Host "   OK - Docker 및 WSL이 완전히 종료되었습니다." -ForegroundColor Green
            } else {
                Write-Host "   Docker DB 컨테이너를 실행 상태로 유지합니다." -ForegroundColor DarkGray
            }
        }
    }
    Write-Host "`n== 종료 완료." -ForegroundColor Green
}
