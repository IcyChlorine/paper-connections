[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "Medium")]
param(
	[Parameter(Mandatory = $true)]
	[ValidateSet("default", "develop")]
	[string]$ProfileName,

	[string]$ZoteroExePath = "C:\Program Files\Zotero\zotero.exe",

	[string]$RepoSrcPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $RepoSrcPath) {
	$RepoSrcPath = Join-Path (Split-Path -Parent $PSScriptRoot) "src"
}

function Get-FullPath {
	param(
		[Parameter(Mandatory = $true)]
		[string]$PathValue
	)

	return [System.IO.Path]::GetFullPath($PathValue)
}

function Get-ProfileRecord {
	param(
		[Parameter(Mandatory = $true)]
		[string]$ProfilesIniPath,

		[Parameter(Mandatory = $true)]
		[string]$TargetProfileName
	)

	if (-not (Test-Path -LiteralPath $ProfilesIniPath -PathType Leaf)) {
		throw "profiles.ini not found: $ProfilesIniPath"
	}

	$profilesRoot = Split-Path -Parent $ProfilesIniPath
	$profiles = New-Object System.Collections.ArrayList
	$currentSection = $null
	$currentValues = @{}

	function Add-CurrentProfile {
		param(
			[string]$SectionName,
			[hashtable]$Values
		)

		if (-not $SectionName -or -not $SectionName.StartsWith("Profile", [System.StringComparison]::OrdinalIgnoreCase)) {
			return
		}
		if (-not $Values.ContainsKey("Name") -or -not $Values.ContainsKey("Path")) {
			return
		}

		$isRelative = $Values["IsRelative"] -eq "1"
		$rawPath = $Values["Path"]
		$resolvedPath = if ($isRelative) {
			Get-FullPath (Join-Path $profilesRoot $rawPath)
		}
		else {
			Get-FullPath $rawPath
		}

		[void]$profiles.Add([PSCustomObject]@{
			Name = $Values["Name"]
			Directory = $resolvedPath
			IsRelative = $isRelative
			RawPath = $rawPath
		})
	}

	foreach ($rawLine in Get-Content -LiteralPath $ProfilesIniPath) {
		$line = $rawLine.Trim()
		if ($line -match '^\[(.+)\]$') {
			Add-CurrentProfile -SectionName $currentSection -Values $currentValues
			$currentSection = $matches[1]
			$currentValues = @{}
			continue
		}
		if (-not $line -or $line.StartsWith(";") -or $line.StartsWith("#")) {
			continue
		}

		$keyValue = $line -split "=", 2
		if ($keyValue.Count -ne 2) {
			continue
		}
		$currentValues[$keyValue[0].Trim()] = $keyValue[1].Trim()
	}

	Add-CurrentProfile -SectionName $currentSection -Values $currentValues

	$matchingProfiles = @($profiles | Where-Object { $_.Name -eq $TargetProfileName })
	if ($matchingProfiles.Count -eq 0) {
		throw "Profile '$TargetProfileName' not found in $ProfilesIniPath"
	}
	if ($matchingProfiles.Count -gt 1) {
		throw "Profile '$TargetProfileName' is defined multiple times in $ProfilesIniPath"
	}

	return $matchingProfiles[0]
}

function Read-TextFile {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path
	)

	$stream = [System.IO.File]::OpenRead($Path)
	try {
		$reader = New-Object System.IO.StreamReader($stream, $true)
		try {
			$content = $reader.ReadToEnd()
			$encoding = $reader.CurrentEncoding
		}
		finally {
			$reader.Dispose()
		}
	}
	finally {
		$stream.Dispose()
	}

	return [PSCustomObject]@{
		Content = $content
		Encoding = $encoding
	}
}

function Write-TextFile {
	param(
		[Parameter(Mandatory = $true)]
		[string]$Path,

		[Parameter(Mandatory = $true)]
		[string]$Content,

		[Parameter(Mandatory = $true)]
		[System.Text.Encoding]$Encoding
	)

	[System.IO.File]::WriteAllText($Path, $Content, $Encoding)
}

$repoSrcFullPath = Get-FullPath $RepoSrcPath
$bootstrapPath = Join-Path $repoSrcFullPath "bootstrap.js"
$manifestPath = Join-Path $repoSrcFullPath "manifest.json"

if (-not (Test-Path -LiteralPath $bootstrapPath -PathType Leaf)) {
	throw "bootstrap.js not found in source directory: $bootstrapPath"
}
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
	throw "manifest.json not found in source directory: $manifestPath"
}
if (-not (Test-Path -LiteralPath $ZoteroExePath -PathType Leaf)) {
	throw "Zotero executable not found: $ZoteroExePath"
}

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$pluginID = $manifest.applications.zotero.id
if (-not $pluginID) {
	throw "Could not read applications.zotero.id from $manifestPath"
}

$profilesIniPath = Join-Path $env:APPDATA "Zotero\Zotero\profiles.ini"
$profile = Get-ProfileRecord -ProfilesIniPath $profilesIniPath -TargetProfileName $ProfileName
$extensionsDir = Join-Path $profile.Directory "extensions"
$proxyFilePath = Join-Path $extensionsDir $pluginID
$xpiPath = Join-Path $extensionsDir "$pluginID.xpi"
$prefsPath = Join-Path $profile.Directory "prefs.js"

Write-Host "Target profile: $($profile.Name)"
Write-Host "Profile directory: $($profile.Directory)"
Write-Host "Plugin id: $pluginID"
Write-Host "Source directory: $repoSrcFullPath"
Write-Host "Zotero executable: $ZoteroExePath"

if (-not (Test-Path -LiteralPath $extensionsDir -PathType Container)) {
	if ($PSCmdlet.ShouldProcess($extensionsDir, "Create extensions directory")) {
		New-Item -ItemType Directory -Path $extensionsDir | Out-Null
	}
}

if (Test-Path -LiteralPath $xpiPath) {
	if ($PSCmdlet.ShouldProcess($xpiPath, "Remove installed plugin XPI")) {
		Remove-Item -LiteralPath $xpiPath -Force
	}
}

if (Test-Path -LiteralPath $proxyFilePath -PathType Container) {
	throw "Extension proxy path is a directory, expected a file: $proxyFilePath"
}

$proxyEncoding = New-Object System.Text.UTF8Encoding($false)
$existingProxyContent = if (Test-Path -LiteralPath $proxyFilePath -PathType Leaf) {
	(Read-TextFile -Path $proxyFilePath).Content.Trim()
}
else {
	$null
}
if ($existingProxyContent -ne $repoSrcFullPath) {
	if ($PSCmdlet.ShouldProcess($proxyFilePath, "Write extension proxy file")) {
		Write-TextFile -Path $proxyFilePath -Content $repoSrcFullPath -Encoding $proxyEncoding
	}
}

if (Test-Path -LiteralPath $prefsPath -PathType Leaf) {
	$prefsFile = Read-TextFile -Path $prefsPath
	$lineBreak = if ($prefsFile.Content.Contains("`r`n")) { "`r`n" } else { "`n" }
	$filteredLines = foreach ($line in ($prefsFile.Content -split '\r?\n')) {
		if ($line -match '^user_pref\("extensions\.lastApp(BuildId|Version)",') {
			continue
		}
		$line
	}
	$filteredContent = ($filteredLines -join $lineBreak).TrimEnd("`r", "`n")
	if ($filteredContent.Length -gt 0) {
		$filteredContent += $lineBreak
	}

	if ($filteredContent -ne $prefsFile.Content) {
		if ($PSCmdlet.ShouldProcess($prefsPath, "Remove extensions.lastApp* cache markers")) {
			Write-TextFile -Path $prefsPath -Content $filteredContent -Encoding $prefsFile.Encoding
		}
	}
}

Write-Host "Source-loaded plugin setup is ready for profile '$ProfileName'."
Write-Host "Next step: run .\tools\restart-zotero-dev.ps1 -ProfileName $ProfileName"
