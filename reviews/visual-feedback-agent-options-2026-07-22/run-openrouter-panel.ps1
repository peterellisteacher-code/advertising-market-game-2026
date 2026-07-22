$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game'
$runner = 'C:\Users\Peter Ellis\.codex\scripts\openrouter-multimodal-request.mjs'
$prompt = Join-Path $projectRoot 'reviews\visual-feedback-agent-options-2026-07-22\panel-brief.txt'
$image = 'C:\Users\PETERE~1\AppData\Local\Temp\codex-clipboard-d267fbee-c41b-463c-8466-c4dcc7fb5198.png'
$outputDirectory = Join-Path $projectRoot 'reviews\visual-feedback-agent-options-2026-07-22'
$node = (Get-Command node -ErrorAction Stop).Source

$storedKey = [Environment]::GetEnvironmentVariable('OPENROUTER_API_KEY', 'User')
if ([string]::IsNullOrWhiteSpace($storedKey)) {
    throw 'OPENROUTER_API_KEY user variable is not available.'
}
$env:OPENROUTER_API_KEY = $storedKey
$storedKey = $null

$seats = @(
    @{ Model = 'anthropic/claude-opus-4.8'; File = 'opus-4.8.json'; Image = $true },
    @{ Model = 'moonshotai/kimi-k3'; File = 'kimi-k3.json'; Image = $true },
    @{ Model = 'moonshotai/kimi-k2.7-code'; File = 'kimi-k2.7-code.json'; Image = $true },
    @{ Model = 'z-ai/glm-5.2'; File = 'glm-5.2.json'; Image = $false },
    @{ Model = '~google/gemini-pro-latest'; File = 'gemini-pro-latest.json'; Image = $true },
    @{ Model = 'x-ai/grok-4.5'; File = 'grok-4.5.json'; Image = $true }
)

$jobs = foreach ($seat in $seats) {
    $output = Join-Path $outputDirectory $seat.File
    if (Test-Path -LiteralPath $output) {
        throw "Refusing to overwrite existing panel output: $output"
    }

    Start-Job -Name $seat.Model -ScriptBlock {
        param($Node, $Runner, $Model, $Prompt, $Image, $Output, $AttachImage)

        $arguments = @(
            $Runner,
            '--model', $Model,
            '--prompt-file', $Prompt,
            '--output-file', $Output,
            '--max-tokens', '32000',
            '--timeout-ms', '840000'
        )
        if ($AttachImage) {
            $arguments += @('--image', $Image)
        }

        & $Node @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Panel request failed for $Model with exit code $LASTEXITCODE"
        }
    } -ArgumentList $node, $runner, $seat.Model, $prompt, $image, $output, $seat.Image
}

$jobs | Wait-Job | Out-Null
$failed = @($jobs | Where-Object State -ne 'Completed')
foreach ($job in $jobs) {
    Receive-Job -Job $job
}
if ($failed.Count -gt 0) {
    $names = ($failed | ForEach-Object Name) -join ', '
    throw "One or more panel seats failed: $names"
}
