# Synthetic, non-personal speech for real audio upload/transcription checks.
# Run with Windows PowerShell where System.Speech is available.
Add-Type -AssemblyName System.Speech
$fixtureDirectory = Join-Path $PSScriptRoot '..\.database-audit\fixtures'
[System.IO.Directory]::CreateDirectory($fixtureDirectory) | Out-Null
$fixturePath = [System.IO.Path]::GetFullPath((Join-Path $fixtureDirectory 'voice-release.wav'))
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $speaker.SetOutputToWaveFile($fixturePath)
    $speaker.Speak('Synthetic TARS voice test. Meeting on Wednesday at eleven thirty in the morning. Reference code ORBIT five two nine.')
} finally {
    $speaker.Dispose()
}
Get-Item -LiteralPath $fixturePath | Select-Object Name, Length
