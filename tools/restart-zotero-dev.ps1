[CmdletBinding()]
param(
	[Parameter(Mandatory = $true)]
	[ValidateSet("default", "develop")]
	[string]$ProfileName,

	[string]$ZoteroExePath = "C:\Program Files\Zotero\zotero.exe",

	[switch]$JsDebugger,

	[switch]$NoPurgeCaches
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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

function Stop-ZoteroProcesses {
	param(
		[Parameter(Mandatory = $true)]
		[System.Diagnostics.Process[]]$Processes
	)

	foreach ($process in $Processes) {
		try {
			if ($process.MainWindowHandle -ne 0) {
				$null = $process.CloseMainWindow()
			}
		}
		catch {
		}
	}

	$deadline = (Get-Date).AddSeconds(15)
	do {
		Start-Sleep -Milliseconds 500
		$remaining = @(
			foreach ($process in $Processes) {
				try {
					$refreshed = Get-Process -Id $process.Id -ErrorAction Stop
					if ($refreshed) {
						$refreshed
					}
				}
				catch {
				}
			}
		)
	} while ($remaining.Count -gt 0 -and (Get-Date) -lt $deadline)

	if ($remaining.Count -gt 0) {
		$remaining | Stop-Process -Force
	}
}

if (-not (Test-Path -LiteralPath $ZoteroExePath -PathType Leaf)) {
	throw "Zotero executable not found: $ZoteroExePath"
}

$profilesIniPath = Join-Path $env:APPDATA "Zotero\Zotero\profiles.ini"
$profile = Get-ProfileRecord -ProfilesIniPath $profilesIniPath -TargetProfileName $ProfileName
$runningZotero = @(Get-Process -Name zotero -ErrorAction SilentlyContinue)

Write-Host "Target profile: $($profile.Name)"
Write-Host "Profile directory: $($profile.Directory)"
Write-Host "Zotero executable: $ZoteroExePath"

if ($runningZotero.Count -gt 0) {
	$runningIDs = ($runningZotero | Select-Object -ExpandProperty Id) -join ", "
	Write-Host "Detected running Zotero process(es): $runningIDs"
	$confirmation = Read-Host "Close and relaunch Zotero with profile '$ProfileName'? [y/N]"
	if ($confirmation -notmatch '^(y|yes)$') {
		Write-Host "Restart canceled."
		exit 0
	}

	Stop-ZoteroProcesses -Processes $runningZotero
}

$argumentList = @("-p", $ProfileName)
if (-not $NoPurgeCaches) {
	$argumentList += "-purgecaches"
}
if ($JsDebugger) {
	$argumentList += "-jsdebugger"
}

$started = Start-Process -FilePath $ZoteroExePath -ArgumentList $argumentList -PassThru
Write-Host "Started Zotero (PID $($started.Id)) with arguments: $($argumentList -join ' ')"
