[CmdletBinding()]
param(
	[Parameter(Mandatory = $true)]
	[ValidateSet("default", "develop")]
	[string]$ProfileName,

	[string]$ZoteroExePath = "C:\Program Files\Zotero\zotero.exe",

	[string]$XpiPath,

	[switch]$JsDebugger,

	[switch]$NoPurgeCaches
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $XpiPath) {
	$XpiPath = Join-Path (Split-Path -Parent $PSScriptRoot) "build\paper-connections.xpi"
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

function Remove-ExtensionLastAppPrefs {
	param(
		[Parameter(Mandatory = $true)]
		[string]$PrefsPath
	)

	if (-not (Test-Path -LiteralPath $PrefsPath -PathType Leaf)) {
		return
	}

	$prefsFile = Read-TextFile -Path $PrefsPath
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
		Write-TextFile -Path $PrefsPath -Content $filteredContent -Encoding $prefsFile.Encoding
	}
}

function Get-RunningZoteroProcesses {
	$processes = @(Get-Process -Name zotero -ErrorAction SilentlyContinue)
	return $processes
}

function Wait-ForZoteroExit {
	param(
		[int]$TimeoutSeconds = 15
	)

	$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
	do {
		$remaining = @(Get-RunningZoteroProcesses)
		if ($remaining.Count -eq 0) {
			return $true
		}

		Start-Sleep -Milliseconds 500
	} while ((Get-Date) -lt $deadline)

	return (@(Get-RunningZoteroProcesses)).Count -eq 0
}

function Stop-ZoteroProcesses {
	$processes = @(Get-RunningZoteroProcesses)
	if ($processes.Count -eq 0) {
		return
	}

	foreach ($process in $Processes) {
		try {
			if ($process.MainWindowHandle -ne 0) {
				$null = $process.CloseMainWindow()
			}
		}
		catch {
		}
	}

	if (Wait-ForZoteroExit -TimeoutSeconds 15) {
		return
	}

	$remaining = @(Get-RunningZoteroProcesses)
	if ($remaining.Count -gt 0) {
		$remaining | Stop-Process -Force -ErrorAction Stop
		if (-not (Wait-ForZoteroExit -TimeoutSeconds 15)) {
			$processList = ((@(Get-RunningZoteroProcesses)).Id | Sort-Object) -join ", "
			throw "Failed to stop all Zotero processes. Remaining PIDs: $processList"
		}
	}
}

function Copy-FileWithRetry {
	param(
		[Parameter(Mandatory = $true)]
		[string]$SourcePath,

		[Parameter(Mandatory = $true)]
		[string]$DestinationPath,

		[int]$MaxAttempts = 10,

		[int]$DelayMilliseconds = 500
	)

	for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
		try {
			Copy-Item -LiteralPath $SourcePath -Destination $DestinationPath -Force
			return
		}
		catch {
			if ($attempt -eq $MaxAttempts) {
				throw
			}

			Start-Sleep -Milliseconds $DelayMilliseconds
		}
	}
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$xpiFullPath = Get-FullPath $XpiPath
$manifestPath = Join-Path $repoRoot "src\manifest.json"
$buildScriptPath = Join-Path $repoRoot "make-zips.ps1"

if (-not (Test-Path -LiteralPath $ZoteroExePath -PathType Leaf)) {
	throw "Zotero executable not found: $ZoteroExePath"
}
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
	throw "manifest.json not found: $manifestPath"
}
if (-not (Test-Path -LiteralPath $buildScriptPath -PathType Leaf)) {
	throw "Build script not found: $buildScriptPath"
}

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$pluginID = $manifest.applications.zotero.id
if (-not $pluginID) {
	throw "Could not read applications.zotero.id from $manifestPath"
}

$profilesIniPath = Join-Path $env:APPDATA "Zotero\Zotero\profiles.ini"
$profile = Get-ProfileRecord -ProfilesIniPath $profilesIniPath -TargetProfileName $ProfileName
$extensionsDir = Join-Path $profile.Directory "extensions"
$targetXpiPath = Join-Path $extensionsDir "$pluginID.xpi"
$targetProxyPath = Join-Path $extensionsDir $pluginID
$prefsPath = Join-Path $profile.Directory "prefs.js"
$runningZotero = @(Get-RunningZoteroProcesses)

Write-Host "Target profile: $($profile.Name)"
Write-Host "Profile directory: $($profile.Directory)"
Write-Host "Plugin id: $pluginID"
Write-Host "Zotero executable: $ZoteroExePath"
Write-Host "Build script: $buildScriptPath"
Write-Host "Target XPI path: $targetXpiPath"

$confirmation = Read-Host "Build, install, and restart Zotero for profile '$ProfileName'? [y/N]"
if ($confirmation -notmatch '^(y|yes)$') {
	Write-Host "Install canceled."
	exit 0
}

& $buildScriptPath

if (-not (Test-Path -LiteralPath $xpiFullPath -PathType Leaf)) {
	throw "Built XPI not found: $xpiFullPath"
}

if (-not (Test-Path -LiteralPath $extensionsDir -PathType Container)) {
	New-Item -ItemType Directory -Path $extensionsDir | Out-Null
}

if ($runningZotero.Count -gt 0) {
	Stop-ZoteroProcesses
}

if (Test-Path -LiteralPath $targetProxyPath -PathType Leaf) {
	Remove-Item -LiteralPath $targetProxyPath -Force
}

Copy-FileWithRetry -SourcePath $xpiFullPath -DestinationPath $targetXpiPath
Remove-ExtensionLastAppPrefs -PrefsPath $prefsPath

$argumentList = @("-p", $ProfileName)
if (-not $NoPurgeCaches) {
	$argumentList += "-purgecaches"
}
if ($JsDebugger) {
	$argumentList += "-jsdebugger"
}

$started = Start-Process -FilePath $ZoteroExePath -ArgumentList $argumentList -PassThru -ErrorAction Stop
Write-Host "Installed $pluginID to $targetXpiPath"
if ($started -and ($started | Get-Member -Name Id -ErrorAction SilentlyContinue)) {
	Write-Host "Started Zotero (PID $($started.Id)) with arguments: $($argumentList -join ' ')"
}
else {
	Write-Host "Started Zotero with arguments: $($argumentList -join ' ')"
}
