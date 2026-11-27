@echo off
rem Double-click once to put an "Esquisso" shortcut, with the app icon, on your Desktop.
rem The shortcut runs start-windows.bat from this folder.
setlocal
cd /d "%~dp0"
powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $d 'Esquisso.lnk')); $s.TargetPath=(Join-Path (Get-Location) 'start-windows.bat'); $s.WorkingDirectory=(Get-Location).Path; $s.IconLocation=(Join-Path (Get-Location) 'esquisso.ico'); $s.Description='Start Esquisso'; $s.WindowStyle=7; $s.Save()"
if errorlevel 1 (
  echo Could not create the shortcut. See the message above.
) else (
  echo Done. The "Esquisso" shortcut is on your Desktop.
)
pause
