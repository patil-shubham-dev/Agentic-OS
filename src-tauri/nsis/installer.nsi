; AgenticOS — Premium NSIS Installer
; Custom branded installation experience

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "nsProcess.nsh"

; ── Installer Attributes ─────────────────────────────────────────────────────
Name "AgenticOS"
OutFile "AgenticOS-Setup.exe"
InstallDir "$LOCALAPPDATA\AgenticOS"
InstallDirRegKey HKCU "Software\AgenticOS" ""

RequestExecutionLevel user
ShowInstDetails nevershow
ShowUnInstDetails nevershow
SetCompressor /SOLID lzma
SetCompressorDictSize 64
CRCCheck on
XPStyle on

; ── Version Info ─────────────────────────────────────────────────────────────
VIProductVersion "2.1.0.0"
VIAddVersionKey "ProductName" "AgenticOS"
VIAddVersionKey "FileVersion" "2.1.0"
VIAddVersionKey "ProductVersion" "2.1.0"
VIAddVersionKey "FileDescription" "AgenticOS — Your AI operating system for development"
VIAddVersionKey "LegalCopyright" "Copyright © 2026 AgenticOS"
VIAddVersionKey "CompanyName" "AgenticOS"

; ── Modern UI Settings ──────────────────────────────────────────────────────
!define MUI_ABORTWARNING
!define MUI_ABORTWARNING_TEXT "Are you sure you want to cancel AgenticOS installation?"
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\win.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\win.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP ""
!define MUI_HEADERIMAGE_UNBITMAP ""
!define MUI_WELCOMEPAGE_TITLE "Welcome to AgenticOS Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through installing AgenticOS $v2.1.0 on your computer.$\r$\n$\r$\nAgenticOS is your AI-powered operating system for development — a unified workspace with intelligent assistance, context-aware tools, and seamless integration.$\r$\n$\r$\nClick Next to continue."

!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "AgenticOS $v2.1.0 has been successfully installed on your computer.$\r$\n$\r$\nYou can launch AgenticOS from the Start Menu or desktop shortcut.$\r$\n$\r$\nThank you for choosing AgenticOS!"
!define MUI_FINISHPAGE_RUN "$INSTDIR\AgenticOS.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch AgenticOS"
!define MUI_FINISHPAGE_LINK "Visit AgenticOS Website"
!define MUI_FINISHPAGE_LINK_LOCATION "https://agenticos.ai"
!define MUI_FINISHPAGE_NOREBOOTSUPPORT

!define MUI_UNWELCOMEPAGE_TITLE "Welcome to AgenticOS Uninstall"
!define MUI_UNWELCOMEPAGE_TEXT "This wizard will remove AgenticOS $v2.1.0 from your computer.$\r$\n$\r$\nAll application data and settings will be permanently deleted.$\r$\n$\r$\nClick Uninstall to proceed."

; ── Pages ────────────────────────────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "$TEMP\agenticos-license.rtf"
!insertmacro MUI_PAGE_DIRECTORY
Page custom InstallTypePage InstallTypePageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; ── Language ─────────────────────────────────────────────────────────────────
!insertmacro MUI_LANGUAGE "English"

; ── Variables ────────────────────────────────────────────────────────────────
Var InstallType

; ── Custom Page: Install Type ───────────────────────────────────────────────
Function InstallTypePage
  !insertmacro MUI_HEADER_TEXT "Installation Options" "Choose your preferred installation type"
  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0 0 100% 20u \
    "Select the installation type that best suits your needs:"
  Pop $0

  ${NSD_CreateRadioButton} 15u 30u 100% 12u \
    "&Standard Install — Recommended for most users"
  Pop $1
  ${NSD_Check} $1
  StrCpy $InstallType "standard"

  ${NSD_CreateRadioButton} 15u 50u 100% 12u \
    "&Portable Install — No registry changes, runs from this folder"
  Pop $2

  ${NSD_CreateRadioButton} 15u 70u 100% 12u \
    "&Developer Install — Includes debug symbols and dev tools"
  Pop $3

  nsDialogs::Show
FunctionEnd

Function InstallTypePageLeave
  ${NSD_GetState} $1 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $InstallType "standard"
  ${EndIf}
  ${NSD_GetState} $2 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $InstallType "portable"
  ${EndIf}
  ${NSD_GetState} $3 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $InstallType "developer"
  ${EndIf}
FunctionEnd

; ── Sections ─────────────────────────────────────────────────────────────────
Section "AgenticOS" SecMain
  SectionIn RO

  ; Kill running instances
  nsProcess::_FindProcess "AgenticOS.exe"
  Pop $0
  ${If} $0 = 0
    nsProcess::_KillProcess "AgenticOS.exe"
    Pop $0
    Sleep 500
  ${EndIf}
  nsProcess::_Unload

  SetOutPath "$INSTDIR"

  ; Tauri build places files here — this section gets populated by the build
  ; The !include directive below gets expanded by the Tauri build process

  ; Write uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Registry entries
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS" \
    "DisplayName" "AgenticOS"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS" \
    "DisplayVersion" "2.1.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS" \
    "DisplayIcon" "$INSTDIR\AgenticOS.exe,0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS" \
    "Publisher" "AgenticOS"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS" \
    "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS" \
    "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS" \
    "NoRepair" 1
  WriteRegStr HKCU "Software\AgenticOS" "" "$INSTDIR"

  ; ── Post-install verification ───────────────────────────────────────────
  IfFileExists "$INSTDIR\AgenticOS.exe" installed_success installed_fail
  installed_success:
    DetailPrint "✓ AgenticOS installed successfully"
    Goto installed_end
  installed_fail:
    DetailPrint "✗ Installation failed — AgenticOS.exe not found"
    Abort "Installation failed: application files missing."
  installed_end:
SectionEnd

; ── Desktop Shortcut ────────────────────────────────────────────────────────
Section "Desktop Shortcut" SecDesktop
  CreateShortCut "$DESKTOP\AgenticOS.lnk" "$INSTDIR\AgenticOS.exe"
SectionEnd

; ── Start Menu ──────────────────────────────────────────────────────────────
Section "Start Menu Shortcut" SecStartMenu
  CreateDirectory "$SMPROGRAMS\AgenticOS"
  CreateShortCut "$SMPROGRAMS\AgenticOS\AgenticOS.lnk" "$INSTDIR\AgenticOS.exe"
  CreateShortCut "$SMPROGRAMS\AgenticOS\Uninstall AgenticOS.lnk" "$INSTDIR\uninstall.exe"
SectionEnd

; ── Section descriptions ────────────────────────────────────────────────────
LangString DESC_SecMain ${LANG_ENGLISH} "Core AgenticOS application files"
LangString DESC_SecDesktop ${LANG_ENGLISH} "Add a shortcut to AgenticOS on your desktop"
LangString DESC_SecStartMenu ${LANG_ENGLISH} "Add shortcuts to the Start Menu"

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecMain} $(DESC_SecMain)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} $(DESC_SecDesktop)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStartMenu} $(DESC_SecStartMenu)
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ── Uninstaller ─────────────────────────────────────────────────────────────
Section "Uninstall"
  ; Kill running instance
  nsProcess::_FindProcess "AgenticOS.exe"
  Pop $0
  ${If} $0 = 0
    nsProcess::_KillProcess "AgenticOS.exe"
    Pop $0
    Sleep 500
  ${EndIf}
  nsProcess::_Unload

  ; Uninstall survey dialog
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Would you like to share anonymous feedback about why you're uninstalling?$\r$\nYour input helps us improve AgenticOS." \
    IDNO skip_survey
    ExecShell "open" "https://agenticos.ai/uninstall-survey"
  skip_survey:

  ; Remove files
  RMDir /r "$INSTDIR\*.*"
  RMDir "$INSTDIR"

  ; Remove shortcuts
  Delete "$DESKTOP\AgenticOS.lnk"
  RMDir /r "$SMPROGRAMS\AgenticOS"

  ; Remove registry
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS"
  DeleteRegKey HKCU "Software\AgenticOS"

  ; Cleanup user data (optional — offer choice)
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Would you like to remove all AgenticOS user data (settings, sessions, cached files)?$\r$\nThis action cannot be undone." \
    IDNO skip_data
    RMDir /r "$APPDATA\com.agenticos.studio"
  skip_data:

  DetailPrint "✓ AgenticOS has been removed from your computer."
SectionEnd
