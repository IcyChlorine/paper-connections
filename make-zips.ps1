Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$buildDir = Join-Path $repoRoot "build"
$srcDir = Join-Path $repoRoot "src"
$xpiPath = Join-Path $buildDir "paper-relations.xpi"
$zipPath = Join-Path $buildDir "paper-relations.zip"
$templatePath = Join-Path $repoRoot "updates.json.tmpl"
$updatesPath = Join-Path $buildDir "updates.json"

$packList = @(
	"bootstrap.js",
	"locale",
	"assets",
	"storage.js",
	"graph-workspace.js",
	"paper-relations.js",
	"manifest.json",
	"prefs.js",
	"style.css"
)

if (Test-Path $buildDir) {
	Remove-Item -Path $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Path $buildDir | Out-Null

Push-Location $srcDir
try {
	Compress-Archive -Path $packList -DestinationPath $zipPath -CompressionLevel Optimal
}
finally {
	Pop-Location
}
Move-Item -Path $zipPath -Destination $xpiPath -Force

$hash = (Get-FileHash -Path $xpiPath -Algorithm SHA256).Hash.ToLowerInvariant()
$templateContent = Get-Content -Raw -Path $templatePath
$updatedContent = [System.Text.RegularExpressions.Regex]::Replace(
	$templateContent,
	'("update_hash"\s*:\s*")sha256:[^"]*(")',
	"`$1sha256:$hash`$2",
	[System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)
if ($updatedContent -eq $templateContent) {
	throw "Failed to update update_hash in updates.json.tmpl"
}
Set-Content -Path $updatesPath -Value $updatedContent -Encoding ascii
