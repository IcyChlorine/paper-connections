Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$buildDir = Join-Path $repoRoot "build"
$srcDir = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "src"))
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
	"graph-workspace-context-export.js",
	"paper-relations.js",
	"manifest.json",
	"prefs.js",
	"style.css"
)

if (Test-Path $buildDir) {
	Remove-Item -Path $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Path $buildDir | Out-Null

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
	foreach ($relPath in $packList) {
		$fullPath = [System.IO.Path]::GetFullPath((Join-Path $srcDir $relPath))
		if (-not $fullPath.StartsWith($srcDir, [System.StringComparison]::OrdinalIgnoreCase)) {
			throw "Invalid pack path outside src: $relPath"
		}
		if (Test-Path -Path $fullPath -PathType Leaf) {
			$entryName = ($relPath -replace "\\", "/")
			[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
				$archive,
				$fullPath,
				$entryName,
				[System.IO.Compression.CompressionLevel]::Optimal
			) | Out-Null
			continue
		}
		if (Test-Path -Path $fullPath -PathType Container) {
			Get-ChildItem -Path $fullPath -Recurse -File | ForEach-Object {
				$childFullPath = [System.IO.Path]::GetFullPath($_.FullName)
				$entryRelative = $childFullPath.Substring($srcDir.Length).TrimStart("\", "/")
				$entryName = ($entryRelative -replace "\\", "/")
				[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
					$archive,
					$childFullPath,
					$entryName,
					[System.IO.Compression.CompressionLevel]::Optimal
				) | Out-Null
			}
			continue
		}
		throw "Missing pack path: $relPath"
	}
}
finally {
	$archive.Dispose()
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
