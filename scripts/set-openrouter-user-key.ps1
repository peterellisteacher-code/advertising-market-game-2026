[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$secure = Read-Host 'Paste the hard-limited OpenRouter API key' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ($plain -notmatch '^sk-or-v1-[A-Za-z0-9]+$') {
        throw 'The value does not match an OpenRouter API key.'
    }
    [Environment]::SetEnvironmentVariable('OPENROUTER_API_KEY', $plain, 'User')
} finally {
    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    $plain = $null
    $secure = $null
}

if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable('OPENROUTER_API_KEY', 'User'))) {
    throw 'The user-scoped key was not saved.'
}

Write-Host 'OPENROUTER_API_KEY saved for future Codex chats. The key was not printed.'
Read-Host 'Press Enter to close this window'
