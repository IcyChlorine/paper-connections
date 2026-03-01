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
$updates = Get-Content -Raw -Path $templatePath | ConvertFrom-Json
$updates.addons.'paper-relations@example.com'.updates[0].update_hash = "sha256:$hash"
$updates | ConvertTo-Json -Depth 20 | Set-Content -Path $updatesPath -Encoding utf8
