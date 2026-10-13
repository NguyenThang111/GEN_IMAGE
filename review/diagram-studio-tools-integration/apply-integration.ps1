$ErrorActionPreference = 'Stop'
$taskStageRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$taskManifest = Get-Content -LiteralPath (Join-Path $taskStageRoot 'integration-manifest.json') -Raw | ConvertFrom-Json
$taskTargetRoot = [IO.Path]::GetFullPath('C:\Users\thang\Desktop\auto2techos')
if ([IO.Path]::GetFullPath($taskManifest.target) -ne $taskTargetRoot) { throw 'Unexpected target root' }
$taskBackupRoot = Join-Path $taskStageRoot 'original-backup'
$taskCopies = @()
foreach ($taskEntry in $taskManifest.files) {
    $taskRelativePath = [string]$taskEntry.path
    if ([IO.Path]::IsPathRooted($taskRelativePath)) { throw 'Absolute path in manifest' }
    $taskDestination = [IO.Path]::GetFullPath((Join-Path $taskTargetRoot $taskRelativePath))
    $taskSource = [IO.Path]::GetFullPath((Join-Path $taskStageRoot $taskRelativePath))
    if (!$taskDestination.StartsWith($taskTargetRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Target outside project' }
    if (!$taskSource.StartsWith($taskStageRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Source outside staging' }
    if ((Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskEntry.after) { throw ('Staged file changed: ' + $taskRelativePath) }
    if ($null -eq $taskEntry.before) {
        if (Test-Path -LiteralPath $taskDestination) { throw ('New target already exists: ' + $taskRelativePath) }
    } else {
        if (!(Test-Path -LiteralPath $taskDestination -PathType Leaf)) { throw ('Original is missing: ' + $taskRelativePath) }
        if ((Get-FileHash -LiteralPath $taskDestination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskEntry.before) { throw ('Original changed during integration: ' + $taskRelativePath) }
    }
    $taskCopies += [PSCustomObject]@{ Relative = $taskRelativePath; Source = $taskSource; Destination = $taskDestination; Existing = ($null -ne $taskEntry.before); Hash = $taskEntry.after }
}
foreach ($taskCopy in $taskCopies) {
    if ($taskCopy.Existing) {
        $taskBackup = Join-Path $taskBackupRoot $taskCopy.Relative
        New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($taskBackup)) -Force | Out-Null
        Copy-Item -LiteralPath $taskCopy.Destination -Destination $taskBackup
    }
}
foreach ($taskCopy in $taskCopies) {
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($taskCopy.Destination)) -Force | Out-Null
    Copy-Item -LiteralPath $taskCopy.Source -Destination $taskCopy.Destination -Force
    if ((Get-FileHash -LiteralPath $taskCopy.Destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskCopy.Hash) { throw ('Copy verification failed: ' + $taskCopy.Relative) }
}
Write-Output ('Applied and verified ' + $taskCopies.Count + ' files.')
Write-Output ('Backup: ' + $taskBackupRoot)
