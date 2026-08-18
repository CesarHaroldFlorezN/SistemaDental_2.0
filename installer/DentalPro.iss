#define MyAppName "DentalPro"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "DentalPro"
#define MyAppExeName "DentalPro.exe"

[Setup]
AppId={{13CB8B4E-68DB-4B31-A06C-4135E1F663F2}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\DentalPro
DefaultGroupName=DentalPro
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist\instalador
OutputBaseFilename=DentalPro_Instalador_Privado
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=force
RestartApplications=no
SetupLogging=yes
UninstallDisplayIcon={app}\{#MyAppExeName}

[Dirs]
Name: "{commonappdata}\DentalPro"; Permissions: users-modify
Name: "{commonappdata}\DentalPro\data"; Permissions: users-modify
Name: "{commonappdata}\DentalPro\data\documentos"; Permissions: users-modify
Name: "{commonappdata}\DentalPro\data\respaldos"; Permissions: users-modify
Name: "{commonappdata}\DentalPro\data\logs"; Permissions: users-modify

[Files]
Source: "..\dist\DentalPro\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist\payload-clinica\dentalpro.db"; DestDir: "{commonappdata}\DentalPro\data"; Flags: onlyifdoesntexist uninsneveruninstall skipifsourcedoesntexist
Source: "..\dist\payload-clinica\MANIFIESTO_DATOS.json"; DestDir: "{commonappdata}\DentalPro\data"; Flags: onlyifdoesntexist uninsneveruninstall skipifsourcedoesntexist
Source: "..\dist\payload-clinica\documentos\*"; DestDir: "{commonappdata}\DentalPro\data\documentos"; Flags: onlyifdoesntexist uninsneveruninstall recursesubdirs createallsubdirs skipifsourcedoesntexist

[Icons]
Name: "{autodesktop}\DentalPro"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\DentalPro"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir DentalPro"; Flags: nowait postinstall skipifsilent
