param(
    [string]$TargetPath = "doc/current-features.md"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $TargetPath)) {
    throw "Target file not found: $TargetPath"
}

$resolved = (Resolve-Path $TargetPath).Path
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

Write-Host "Fixing ACL for: $resolved"
Write-Host "Current user: $currentUser"

icacls $resolved /reset | Out-Host
icacls $resolved /inheritance:e | Out-Host
icacls $resolved /grant "${currentUser}:(M)" | Out-Host
icacls $resolved /grant "NT AUTHORITY\Authenticated Users:(M)" | Out-Host

Write-Host "ACL fix done."
