$ErrorActionPreference = 'Stop'
$headers = @{ Origin = 'https://pennyroyaljuice.github.io' }
$expectedRelease = '2026-09-25-sense-context-v6'
$health = Invoke-RestMethod -Uri ('https://vocabulary-generator.pennyroyal-juice.workers.dev/?verify=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 20
if ($health.release -ne $expectedRelease) {
    throw "本番の版が一致しません。期待: $expectedRelease / 実際: $($health.release)。生成テストは実行しません。"
}
Write-Output "Release verified: $($health.release)"
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
    @{ word = '斎'; readingHint = ''; contextHint = ''; dictionaryHint = '' },
    @{ word = '斎'; readingHint = 'とき'; contextHint = '法要の後の食事'; dictionaryHint = '' },
    @{ word = '御斎'; readingHint = ''; contextHint = ''; dictionaryHint = '' },
    @{ word = '生物'; readingHint = ''; contextHint = ''; dictionaryHint = '' },
    @{ word = '生物'; readingHint = 'せいぶつ'; contextHint = ''; dictionaryHint = $dictionaryHint },
    @{ word = '生物'; readingHint = 'せいぶつ'; contextHint = '生物学'; dictionaryHint = $dictionaryHint },
    @{ word = '生物'; readingHint = 'なまもの'; contextHint = '加熱していない食べ物'; dictionaryHint = $dictionaryHint },
    @{ word = '敷衍'; readingHint = ''; contextHint = ''; dictionaryHint = '' },
    @{ word = '忖度'; readingHint = ''; contextHint = ''; dictionaryHint = '' },
    @{ word = '役不足'; readingHint = ''; contextHint = ''; dictionaryHint = '' },
    @{ word = '確信犯'; readingHint = ''; contextHint = ''; dictionaryHint = '' },
    @{ word = '漸次'; readingHint = ''; contextHint = ''; dictionaryHint = '' },
    @{ word = '琴線'; readingHint = ''; contextHint = ''; dictionaryHint = '' },
    @{ word = '杜撰'; readingHint = ''; contextHint = ''; dictionaryHint = '' },
    @{ word = '人口に膾炙する'; readingHint = ''; contextHint = ''; dictionaryHint = '' },
    @{ word = '雲菓量子ぽよ'; readingHint = ''; contextHint = ''; dictionaryHint = '' }
)
$results = @()
foreach ($case in $cases) {
    try {
        $body = [System.Text.Encoding]::UTF8.GetBytes(($case | ConvertTo-Json -Compress))
        $result = Invoke-RestMethod -Uri 'https://vocabulary-generator.pennyroyal-juice.workers.dev/' -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body -TimeoutSec 55
        if ($result.release -ne $expectedRelease) { throw '生成応答の版が一致しません。' }
        $results += @{ input = $case; response = $result }
        $result | ConvertTo-Json -Depth 8
    } catch {
        $results += @{ input = $case; error = $_.ErrorDetails.Message; message = $_.Exception.Message }
        Write-Output $_.ErrorDetails.Message
    }
}
@{ checkedAt = (Get-Date -Format o); dictionary = $dictionary; cases = $results } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath "$PSScriptRoot/live-verification.json" -Encoding utf8
