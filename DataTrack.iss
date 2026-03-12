; Script de instalación para DataTrack
; Usar con Inno Setup (https://www.innosetup.com/)
; 
; Instrucciones:
; 1. Descargar e instalar Inno Setup en Windows
; 2. Abrir este archivo con Inno Setup
; 3. Compilar (Build -> Compile)
; 4. Se generará el instalador en Output/

[Setup]
AppName=DataTrack
AppVersion=1.0.0
AppPublisher=Tecnológico Nacional de México - ITT
AppPublisherURL=https://www.tijuana.tecnm.mx
AppSupportURL=https://www.tijuana.tecnm.mx
DefaultDirName={autopf}\DataTrack
DefaultGroupName=DataTrack
AllowNoIcons=yes
OutputDir=Output
OutputBaseFilename=DataTrack-Installer
SetupIconFile=setup.ico
UninstallIconFile=uninstall.ico
Compression=lzma
SolidCompression=yes
PrivilegesRequired=lowest
ChangesAssociations=no
WizardStyle=modern
LicenseFile=LICENSE.txt

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startmenu"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Ejecutable principal
Source: "dist\DataTrack.exe"; DestDir: "{app}"; Flags: ignoreversion
; Modelos YOLO
Source: "yolo11n.pt"; DestDir: "{app}"; Flags: ignoreversion
Source: "yolo11s.pt"; DestDir: "{app}"; Flags: ignoreversion
Source: "yolo11m.pt"; DestDir: "{app}"; Flags: ignoreversion
Source: "yolo11l.pt"; DestDir: "{app}"; Flags: ignoreversion
; Configuración
Source: "config\*"; DestDir: "{app}\config"; Flags: ignoreversion recursesubdirs createallsubdirs
; Templates y static (ya incluidos en EXE por PyInstaller)
; License
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "requirements.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\DataTrack"; Filename: "{app}\DataTrack.exe"; WorkingDir: "{app}"; IconFilename: "{app}\DataTrack.exe"
Name: "{group}\Desinstalar DataTrack"; Filename: "{uninstallexe}"
Name: "{autodesktop}\DataTrack"; Filename: "{app}\DataTrack.exe"; WorkingDir: "{app}"; Tasks: desktopicon; IconFilename: "{app}\DataTrack.exe"

[Run]
Filename: "{app}\DataTrack.exe"; Description: "Ejecutar DataTrack"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: dirsonly; Name: "{app}"

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    MsgBox('DataTrack ha sido instalado exitosamente.' + #13#13 +
           'Se abrirá automáticamente en tu navegador.' + #13 +
           'Puerto: http://localhost:5000', mbInformation, MB_OK);
  end;
end;
