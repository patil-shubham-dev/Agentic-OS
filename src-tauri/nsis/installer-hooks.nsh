; AgenticOS — NSIS Installer Hooks
; Tauri v2 installer lifecycle hooks

!include "LogicLib.nsh"

; ── Pre-install hook ─────────────────────────────────────────────────────────
!macro PreInstall
  DetailPrint "Preparing AgenticOS installation…"
  DetailPrint "Platform: Windows"
  DetailPrint "Version: 2.1.0"
  Call CheckPreviousInstall
!macroend

; ── Post-install hook ────────────────────────────────────────────────────────
!macro PostInstall
  DetailPrint "Registering shell extensions…"
  Call RegisterShellExtensions
  DetailPrint "Registering protocol handlers…"
  Call RegisterProtocol
  DetailPrint "Configuring firewall…"
  Call ConfigureFirewall
  DetailPrint "Installation complete."
!macroend

; ── Pre-uninstall hook ───────────────────────────────────────────────────────
!macro PreUninstall
  DetailPrint "Removing shell extensions…"
  Call UnregisterShellExtensions
  DetailPrint "Removing protocol handlers…"
  Call UnregisterProtocol
!macroend

; ── Post-uninstall hook ──────────────────────────────────────────────────────
!macro PostUninstall
  DetailPrint "AgenticOS has been completely removed."
  DetailPrint "Thank you for using AgenticOS."
!macroend

; ── Functions ────────────────────────────────────────────────────────────────

Function CheckPreviousInstall
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS" "DisplayVersion"
  ${If} $0 != ""
    DetailPrint "Previous installation detected: v$0"
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "A previous version of AgenticOS (v$0) is installed.$\r$\nWould you like to upgrade?" \
      IDYES do_upgrade IDNO abort_install
    do_upgrade:
      DetailPrint "Upgrading from v$0 to v2.1.0…"
      ; Kill running instance
      nsProcess::_FindProcess "AgenticOS.exe"
      Pop $1
      ${If} $1 = 0
        nsProcess::_KillProcess "AgenticOS.exe"
        Pop $1
        Sleep 500
      ${EndIf}
      nsProcess::_Unload
      Goto check_done
    abort_install:
      Abort "Installation cancelled by user."
  ${EndIf}
  check_done:
FunctionEnd

Function RegisterShellExtensions
  ; ── "Open with AgenticOS" on folder right-click ────────────────────────────
  WriteRegStr HKCU "Software\Classes\Directory\shell\AgenticOS" "" "Open with AgenticOS"
  WriteRegStr HKCU "Software\Classes\Directory\shell\AgenticOS" "Icon" "$INSTDIR\AgenticOS.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\AgenticOS\command" "" '"$INSTDIR\AgenticOS.exe" "%V"'
  DetailPrint "  ✓ Directory context menu registered"

  ; ── "Open with AgenticOS" on folder background (empty space) ──────────────
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\AgenticOS" "" "Open with AgenticOS"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\AgenticOS" "Icon" "$INSTDIR\AgenticOS.exe"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\AgenticOS\command" "" '"$INSTDIR\AgenticOS.exe" "%V"'
  DetailPrint "  ✓ Folder background context menu registered"

  ; ── "Open with AgenticOS" on drives ───────────────────────────────────────
  WriteRegStr HKCU "Software\Classes\Drive\shell\AgenticOS" "" "Open with AgenticOS"
  WriteRegStr HKCU "Software\Classes\Drive\shell\AgenticOS" "Icon" "$INSTDIR\AgenticOS.exe"
  WriteRegStr HKCU "Software\Classes\Drive\shell\AgenticOS\command" "" '"$INSTDIR\AgenticOS.exe" "%V"'
  DetailPrint "  ✓ Drive context menu registered"

  ; ── Force Explorer to reload icon cache ───────────────────────────────────
  SendMessage 0xFFFF 0x001A 0 0 /TIMEOUT=200
FunctionEnd

Function UnregisterShellExtensions
  DeleteRegKey HKCU "Software\Classes\Directory\shell\AgenticOS"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\AgenticOS"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\AgenticOS"
  DetailPrint "  ✓ Shell extensions removed"

  ; Reload Explorer
  SendMessage 0xFFFF 0x001A 0 0 /TIMEOUT=200
FunctionEnd

Function RegisterProtocol
  ; Register agenticos:// deep link protocol
  WriteRegStr HKCU "Software\Classes\agenticos" "" "URL:AgenticOS Protocol"
  WriteRegStr HKCU "Software\Classes\agenticos" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\agenticos\DefaultIcon" "" "$INSTDIR\AgenticOS.exe,0"
  WriteRegStr HKCU "Software\Classes\agenticos\shell\open\command" "" '"$INSTDIR\AgenticOS.exe" "%1"'
  DetailPrint "  ✓ agenticos:// protocol registered"
FunctionEnd

Function UnregisterProtocol
  DeleteRegKey HKCU "Software\Classes\agenticos"
  DetailPrint "  ✓ agenticos:// protocol removed"
FunctionEnd

Function ConfigureFirewall
  ; Add Windows Firewall exception for private network
  nsExec::ExecToStack 'netsh advfirewall firewall add rule name="AgenticOS" dir=in action=allow program="$INSTDIR\AgenticOS.exe" enable=yes profile=private'
  Pop $0
  ${If} $0 = 0
    DetailPrint "  ✓ Firewall rule added"
  ${Else}
    DetailPrint "  ⚠ Could not add firewall rule (may need admin rights)"
  ${EndIf}
FunctionEnd
