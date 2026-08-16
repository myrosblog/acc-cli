# vhs tape for the README demo, regenerate with: vhs docs/media/acc-pull.tape
# Docs: https://github.com/charmbracelet/vhs
#
# Records `acc instance pull` against a real instance:
#   - a PowerShell-style prompt is used (ACC instances run on Windows)
#   - `acc auth list` redacts the password (see fix/auth-list-redacted)
#   - host entry via `acc auth init` is NOT filmed (configure it off-camera,
#     see docs/media/README.md), so no hostname leaks into the GIF.

Output acc-pull.gif

Set Shell "zsh"
Set FontSize 16
Set Width 1200
Set Height 640
Set Padding 20
Set Theme "Dracula"
Set TypingSpeed 60ms

# --- off-camera setup: neutralise the personal prompt/theme, then clear ---
# vhs sources your ~/.zshrc, so a custom/oh-my-zsh/p10k prompt would otherwise
# leak user@host. Drop any precmd/preexec hooks (p10k re-renders via those),
# then set a PowerShell-style prompt, ACC instances usually run on Windows, so
# this reads as native to the audience. For full isolation, see docs/media/README.md.
Hide
Type "precmd_functions=(); preexec_functions=()"
Enter
Type `PROMPT='PS C:\Users\Myros\ac-instance-backup> '`
Enter
Type "clear"
Enter
Show

# --- 1. show the configured alias (password redacted) ---
Type "acc auth list"
Enter
Sleep 2s

# --- 2. the hero command: a recurring pull ---
Type "acc instance pull --alias local"
Enter
Sleep 8s

# let the final summary rest on screen before the loop restarts
Sleep 4s
