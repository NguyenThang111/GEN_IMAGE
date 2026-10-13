##############################################################
# fix-wire-format-r04.ps1
# Converts old wire format to production format across all
# schema files in the output directory.
#
# OLD format (invalid):
#   "from": "compId.terminalId"
#   "to": "compId.terminalId"
#   "points": [[x,y],[x,y]]
#   "color": "#hex"
#   "colorCode": "CODE"
#
# NEW format (production AB160 reference):
#   "from": {"componentId": "...", "terminalId": "..."}
#   "to": {"componentId": "...", "terminalId": "..."}
#   "points": [{"x":n,"y":n},...]
#   "primaryColor": "#hex"
#   "code": "CODE"
#   "state": "controlled"
##############################################################

$dir = 'D:\02. DOCUMENTS\00. SOURCE CODE\test\review\air-blade-125-abs-2026-gen-2026-10-13\r01\output'
$files = Get-ChildItem -LiteralPath $dir -Filter '*.json'

foreach ($f in $files) {
    $raw = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
    $data = $raw | ConvertFrom-Json

    if (-not $data.wires) { continue }

    $changed = $false
    $newWires = @()

    foreach ($w in $data.wires) {
        $wObj = [ordered]@{}

        # id
        $wObj['id'] = $w.id

        # from: convert "comp.terminal" string -> object
        if ($w.from -is [string] -and $w.from -match '^(.+)\.(.+)$') {
            $wObj['from'] = [ordered]@{ componentId = $Matches[1]; terminalId = $Matches[2] }
            $changed = $true
        } elseif ($w.from -is [PSCustomObject]) {
            $wObj['from'] = [ordered]@{ componentId = $w.from.componentId; terminalId = $w.from.terminalId }
        } else {
            $wObj['from'] = $w.from
        }

        # to: convert "comp.terminal" string -> object
        if ($w.to -is [string] -and $w.to -match '^(.+)\.(.+)$') {
            $wObj['to'] = [ordered]@{ componentId = $Matches[1]; terminalId = $Matches[2] }
            $changed = $true
        } elseif ($w.to -is [PSCustomObject]) {
            $wObj['to'] = [ordered]@{ componentId = $w.to.componentId; terminalId = $w.to.terminalId }
        } else {
            $wObj['to'] = $w.to
        }

        # points: convert [[x,y],...] array-of-arrays -> [{x,y},...]
        $pts = $w.points
        if ($pts -and $pts[0] -is [System.Array]) {
            $newPts = @()
            foreach ($p in $pts) {
                $newPts += [ordered]@{ x = $p[0]; y = $p[1] }
            }
            $wObj['points'] = $newPts
            $changed = $true
        } elseif ($pts) {
            $newPts = @()
            foreach ($p in $pts) {
                $newPts += [ordered]@{ x = $p.x; y = $p.y }
            }
            $wObj['points'] = $newPts
        }

        # code: from colorCode -> code
        if ($w.colorCode) {
            $wObj['code'] = $w.colorCode
            $changed = $true
        } elseif ($w.code) {
            $wObj['code'] = $w.code
        }

        # primaryColor: from color -> primaryColor
        if ($w.PSObject.Properties['color'] -and -not $w.PSObject.Properties['primaryColor']) {
            $wObj['primaryColor'] = $w.color
            $changed = $true
        } elseif ($w.primaryColor) {
            $wObj['primaryColor'] = $w.primaryColor
        }

        # state: add if missing
        if (-not $w.state) {
            $wObj['state'] = 'controlled'
            $changed = $true
        } else {
            $wObj['state'] = $w.state
        }

        # labels: convert if needed
        if ($w.labels) {
            $newLabels = @()
            foreach ($lbl in $w.labels) {
                if ($lbl -is [PSCustomObject]) {
                    $lblObj = [ordered]@{
                        kind   = if ($lbl.kind) { $lbl.kind } else { 'text' }
                        text   = $lbl.text
                        x      = $lbl.x
                        y      = $lbl.y
                        size   = if ($lbl.size) { $lbl.size } else { 13 }
                        anchor = if ($lbl.anchor) { $lbl.anchor } else { 'middle' }
                        rotate = if ($null -ne $lbl.rotate) { $lbl.rotate } else { 0 }
                        bold   = if ($null -ne $lbl.bold) { $lbl.bold } else { $true }
                        fill   = if ($lbl.fill) { $lbl.fill } else { '#343434' }
                        owner  = if ($lbl.owner) { $lbl.owner } else { $w.id }
                        role   = if ($lbl.role) { $lbl.role } else { 'wire-label' }
                    }
                    $newLabels += $lblObj
                }
            }
            if ($newLabels.Count -gt 0) { $wObj['labels'] = $newLabels }
        }

        $newWires += $wObj
    }

    if ($changed) {
        $data.wires = $newWires
        $json = $data | ConvertTo-Json -Depth 20 -Compress:$false
        Set-Content -LiteralPath $f.FullName -Value $json -Encoding UTF8 -NoNewline
        Write-Host "Fixed wires: $($f.Name)"
    } else {
        Write-Host "Already OK: $($f.Name)"
    }
}
Write-Host "Done."
