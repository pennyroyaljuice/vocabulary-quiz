$ErrorActionPreference = 'Stop'
$headers = @{ Origin = 'https://pennyroyaljuice.github.io' }
$dictionary = Invoke-RestMethod -Uri 'https://vocabulary-dictionary.pennyroyal-juice.workers.dev/lookup' -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes('{"word":"生物"}')) -TimeoutSec 30
$dictionaryHint = ''
if ($dictionary.found -and $dictionary.entries) {
    $index = 0
    $dictionaryHint = ($dictionary.entries | ForEach-Object {
        $index++
        "候補$index`n読み: $($_.readings -join ', ')`n品詞: $($_.partOfSpeech -join ', ')`n意味: $($_.glosses -join '; ')"
    }) -join "`n`n"
}
$cases = @(
    @{ word = '生物'; readingHint = 'せいぶつ'; contextHint = ''; dictionaryHint = $dictionaryHint },
    @{ word = '生物'; readingHint = 'せいぶつ'; contextHint = '生物学'; dictionaryHint = $dictionaryHint },
    @{ word = '生物'; readingHint = 'なまもの'; contextHint = '加熱していない食べ物'; dictionaryHint = $dictionaryHint },
    @{ word = '雲菓量子ぽよ'; readingHint = ''; contextHint = ''; dictionaryHint = '' }
)
$results = @()
foreach ($case in $cases) {
    try {
        $body = [System.Text.Encoding]::UTF8.GetBytes(($case | ConvertTo-Json -Compress))
        $result = Invoke-RestMethod -Uri 'https://vocabulary-generator.pennyroyal-juice.workers.dev/' -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 55
        $results += @{ input = $case; response = $result }
        $result | ConvertTo-Json -Depth 8
    } catch {
        $results += @{ input = $case; error = $_.ErrorDetails.Message; message = $_.Exception.Message }
        Write-Output $_.ErrorDetails.Message
    }
}
@{ checkedAt = (Get-Date -Format o); dictionary = $dictionary; cases = $results } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath "$PSScriptRoot/live-verification.json" -Encoding utf8
