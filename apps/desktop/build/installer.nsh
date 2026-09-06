!macro customInit
  ; Terminate running processes to prevent file locks during update
  nsExec::Exec 'taskkill /F /IM RenWork.exe /T'
  nsExec::Exec 'taskkill /F /IM "RenWork Server 2016 Cloud.exe" /T'
  nsExec::Exec 'taskkill /F /IM opencode.exe /T'
  nsExec::Exec 'taskkill /F /IM OpenConsole.exe /T'
!macroend

!macro customInstall
  ; Write installation location to registry so updates always preserve the path
  WriteRegStr HKCU "Software\RenWork" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\com.renrenyi.renwork" "InstallLocation" "$INSTDIR"

!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\RenWork"
  DeleteRegKey HKCU "Software\com.renrenyi.renwork"
!macroend
