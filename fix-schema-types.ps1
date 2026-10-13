$dir = 'D:\02. DOCUMENTS\00. SOURCE CODE\test\review\air-blade-125-abs-2026-gen-2026-10-13\r01\output'
$files = Get-ChildItem -LiteralPath $dir -Filter '*.json'
foreach ($f in $files) {
    $content = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
    $changed = $false

    # Fix relay.spst@1 -> relay.contact-coil4@1 + port role names
    if ($content -match 'relay\.spst@1') {
        $content = $content -replace 'relay\.spst@1', 'relay.contact-coil4@1'
        $content = $content -replace '"coil_neg": "col"', '"coil-left": "col"'
        $content = $content -replace '"coil_pos": "cor"', '"coil-right": "cor"'
        $content = $content -replace '"contact_in": "cl"', '"contact-left": "cl"'
        $content = $content -replace '"contact_out": "cr"', '"contact-right": "cr"'
        $changed = $true
    }

    # Fix switch.2pole@1 -> switch.dpst4@1 + port role names
    if ($content -match 'switch\.2pole@1') {
        $content = $content -replace 'switch\.2pole@1', 'switch.dpst4@1'
        $content = $content -replace '"p1_in": "p1-in"', '"pole1-in": "p1-in"'
        $content = $content -replace '"p1_out": "p1-out"', '"pole1-out": "p1-out"'
        $content = $content -replace '"p2_in": "p2-in"', '"pole2-in": "p2-in"'
        $content = $content -replace '"p2_out": "p2-out"', '"pole2-out": "p2-out"'
        $changed = $true
    }

    # Fix relay.dpst@1 -> relay.changeover-coil5@1
    if ($content -match 'relay\.dpst@1') {
        $content = $content -replace 'relay\.dpst@1', 'relay.changeover-coil5@1'
        $changed = $true
    }

    # Also fix type relay -> relay4Pin for relay-main components (where contact-coil4 is used)
    # relay.contact-coil4 uses type relay4Pin; relay.changeover-coil5 uses type relay
    # Only do this for relay-main (not relay-starter which keeps type relay)
    if ($changed) {
        Set-Content -LiteralPath $f.FullName -Value $content -Encoding UTF8 -NoNewline
        Write-Host "Fixed: $($f.Name)"
    }
}
Write-Host "Done."
