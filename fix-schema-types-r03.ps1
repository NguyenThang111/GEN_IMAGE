$dir = 'D:\02. DOCUMENTS\00. SOURCE CODE\test\review\air-blade-125-abs-2026-gen-2026-10-13\r01\output'
$files = Get-ChildItem -LiteralPath $dir -Filter '*.json'
foreach ($f in $files) {
    $content = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
    $changed = $false

    # Fix relay4Pin -> relay (not in production 23-type profile)
    if ($content -match '"type": "relay4Pin"') {
        $content = $content -replace '"type": "relay4Pin"', '"type": "relay"'
        $changed = $true
    }

    # Fix continuation -> device + add symbolType loadGroup
    # Pattern: "type": "continuation",\n      "x": -> "type": "device",\n      "symbolType": "loadGroup",\n      "semanticKind": "continuation.loads",\n      "x":
    if ($content -match '"type": "continuation"') {
        $content = $content -replace '"type": "continuation",', '"type": "device",' + "`n      " + '"symbolType": "loadGroup",' + "`n      " + '"semanticKind": "continuation.loads",'
        $changed = $true
    }

    # Fix symbolRef continuation.loads@1 -> remove (device type doesn't use symbolRef this way)
    # Keep symbolRef for other types but remove continuation.loads@1 entry  
    if ($content -match '"id": "continuation\.loads@1"') {
        # Remove the symbolRef block for continuation.loads
        $content = $content -replace ',\s*"symbolRef":\s*\{\s*"id":\s*"continuation\.loads@1"[^}]*\}', ''
        $changed = $true
    }

    if ($changed) {
        Set-Content -LiteralPath $f.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Fixed: $($f.Name)"
    }
}
Write-Host "Done."
