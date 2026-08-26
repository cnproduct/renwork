!macro customInit
  ; Terminate running processes to prevent file locks during update
  nsExec::Exec 'taskkill /F /IM RenWork.exe /T'
  nsExec::Exec 'taskkill /F /IM opencode.exe /T'
  nsExec::Exec 'taskkill /F /IM OpenConsole.exe /T'
!macroend

!macro customInstall
  ; Write installation location to registry so updates always preserve the path
  WriteRegStr HKCU "Software\RenWork" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\com.renrenyi.renwork" "InstallLocation" "$INSTDIR"

  ; Re-create shortcuts pointing explicitly to the installed executable
  CreateShortcut "$DESKTOP\RenWork.lnk" "$INSTDIR\RenWork.exe" "" "$INSTDIR\RenWork.exe" 0 "" "" "RenWork (人人易AI 数字员工工作台)"
  CreateDirectory "$SMPROGRAMS\RenWork"
  CreateShortcut "$SMPROGRAMS\RenWork\RenWork.lnk" "$INSTDIR\RenWork.exe" "" "$INSTDIR\RenWork.exe" 0 "" "" "RenWork (人人易AI 数字员工工作台)"
!macroend

!macro customUnInstall
  Delete "$DESKTOP\RenWork.lnk"
  Delete "$SMPROGRAMS\RenWork\RenWork.lnk"
  RMDir "$SMPROGRAMS\RenWork"
  DeleteRegKey HKCU "Software\RenWork"
  DeleteRegKey HKCU "Software\com.renrenyi.renwork"
!macroend
