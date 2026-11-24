@echo off
setlocal EnableExtensions
REM ============================================================================
REM  FleetPulse - lance backend, web-responsable et apps mobiles (Expo Go),
REM  chacun dans sa propre fenetre cmd. Relancable : arrete d'abord les
REM  instances precedentes (fenetres "FleetPulse - *" et ports utilises).
REM
REM  Usage :  demarrer-tout.bat          arrete puis relance tout
REM           demarrer-tout.bat stop     arrete tout
REM
REM  Variables surchargeables avant l'appel (set NOM=valeur) :
REM    DB_URL, DB_USER, DB_PASSWORD, JAVA25_HOME, BACKEND_XMX
REM ============================================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

REM --- Sous-commandes executees dans chaque fenetre ---------------------------
if /i "%~1"==":backend"  goto :run_backend
if /i "%~1"==":web"      goto :run_web
if /i "%~1"==":mobile"   goto :run_mobile

REM --- Configuration ----------------------------------------------------------
if not defined DB_URL      set "DB_URL=jdbc:mysql://localhost:3306/livraison?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true"
if not defined DB_USER     set "DB_USER=root"
if not defined DB_PASSWORD set "DB_PASSWORD="
if not defined BACKEND_XMX set "BACKEND_XMX=512m"

echo.
echo === FleetPulse : arret des instances precedentes ===
call :stop_all
if /i "%~1"=="stop" (
    echo Tout est arrete.
    exit /b 0
)

echo.
echo === Verifications ===
call :find_java || exit /b 1
echo Java 25 : %JAVA25_HOME%

call :port_listening 3306
if errorlevel 1 (
    echo [!] MySQL n'ecoute pas sur 3306. Demarrage du service WAMP wampmysqld64...
    net start wampmysqld64 >nul 2>&1
    call :port_listening 3306
    if errorlevel 1 (
        echo [X] MySQL toujours indisponible. Lancez WampServer ^(ou le service wampmysqld64 en admin^) puis relancez ce script.
        exit /b 1
    )
)
echo MySQL     : OK ^(port 3306^)

where node >nul 2>&1 || (echo [X] Node.js introuvable dans le PATH. & exit /b 1)

if not exist "%ROOT%\web-responsable\node_modules" (
    echo Installation des dependances web-responsable...
    pushd "%ROOT%\web-responsable" && call npm install && popd
)
if not exist "%ROOT%\mobile\node_modules" (
    echo Installation des dependances mobile...
    pushd "%ROOT%\mobile" && call npm install && popd
)

echo.
echo === Lancement ===
start "FleetPulse - Backend"         cmd /k call "%~f0" :backend
start "FleetPulse - Web responsable" cmd /k call "%~f0" :web
start "FleetPulse - Mobile client"     cmd /k call "%~f0" :mobile client
start "FleetPulse - Mobile partenaire" cmd /k call "%~f0" :mobile partenaire
start "FleetPulse - Mobile livreur"    cmd /k call "%~f0" :mobile livreur

echo Attente du backend sur le port 8083 (max ~3 min)...
set /a ESSAIS=0
:wait_backend
call :port_listening 8083
if not errorlevel 1 goto :backend_up
set /a ESSAIS+=1
if %ESSAIS% geq 90 (
    echo [!] Le backend ne repond pas encore : voir la fenetre "FleetPulse - Backend".
    goto :summary
)
timeout /t 2 /nobreak >nul
goto :wait_backend
:backend_up
echo Backend   : OK

:summary
echo.
echo ------------------------------------------------------------------
echo  Backend          http://localhost:8083   (Swagger : /swagger-ui.html)
echo  Web responsable  http://localhost:5173   admin@fleetpulse.tn / admin12345
echo  Mobile client    Expo Go, port 8081  (QR dans sa fenetre)
echo  Mobile partenaire Expo Go, port 8082
echo  Mobile livreur   Expo Go, port 8084
echo  Arreter tout :   demarrer-tout.bat stop
echo ------------------------------------------------------------------
exit /b 0


REM ============================================================================
:run_backend
title FleetPulse - Backend
if not defined JAVA25_HOME call :find_java || exit /b 1
set "JAVA_HOME=%JAVA25_HOME%"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "SPRING_DATASOURCE_URL=%DB_URL%"
set "SPRING_DATASOURCE_USERNAME=%DB_USER%"
set "SPRING_DATASOURCE_PASSWORD=%DB_PASSWORD%"
set "SPRING_PROFILES_ACTIVE=demo"
set "APP_DEMO_ENABLED=true"
set "SPRINT2_DONNEES_DEMO=true"
set "CORS_ORIGINES=http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://localhost:8082,http://localhost:8084"
cd /d "%ROOT%\backend"
set "MVN=mvn"
where mvn >nul 2>&1 || set "MVN=mvnw.cmd"
echo Backend : %MVN% spring-boot:run  (JAVA_HOME=%JAVA_HOME%)
call %MVN% -DskipTests spring-boot:run "-Dspring-boot.run.jvmArguments=-Xms64m -Xmx%BACKEND_XMX%" "-Dspring-boot.run.arguments=--spring.jpa.show-sql=false"
echo.
echo [Backend arrete - code %errorlevel%]
exit /b

REM ============================================================================
:run_web
title FleetPulse - Web responsable
cd /d "%ROOT%\web-responsable"
call npm run dev
echo.
echo [Web responsable arrete - code %errorlevel%]
exit /b

REM ============================================================================
:run_mobile
title FleetPulse - Mobile %~2
cd /d "%ROOT%\mobile"
call npm run %~2
echo.
echo [Mobile %~2 arrete - code %errorlevel%]
exit /b

REM ============================================================================
:find_java
if defined JAVA25_HOME if exist "%JAVA25_HOME%\bin\java.exe" exit /b 0
for /d %%D in ("%ROOT%\.tmp\jdk25\jdk-25*") do (
    if exist "%%~D\bin\java.exe" set "JAVA25_HOME=%%~D"
)
if defined JAVA25_HOME exit /b 0
if defined JAVA_HOME (
    "%JAVA_HOME%\bin\java.exe" -version 2>&1 | findstr /c:"version \"25" >nul && (set "JAVA25_HOME=%JAVA_HOME%" & exit /b 0)
)
echo [X] Java 25 introuvable. Definir JAVA25_HOME vers un JDK 25 puis relancer.
exit /b 1

REM ============================================================================
:port_listening
REM errorlevel 0 si le port %1 est en ecoute
netstat -ano -p tcp | findstr /r /c:":%~1 .*LISTENING" >nul
exit /b %errorlevel%

REM ============================================================================
:stop_all
REM 1) fenetres ouvertes par ce script (et tout leur arbre de processus)
for %%T in ("Backend" "Web responsable" "Mobile client" "Mobile partenaire" "Mobile livreur") do (
    taskkill /f /t /fi "WINDOWTITLE eq FleetPulse - %%~T*" >nul 2>&1
)
REM 2) tout ce qui occupe encore les ports de l'application (instances lancees autrement)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports = 8083,5173,8081,8082,8084;" ^
  "Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue |" ^
  " Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 4 } |" ^
  " ForEach-Object { $p = Get-CimInstance Win32_Process -Filter \"ProcessId=$_\";" ^
  "  if ($p -and $p.Name -in 'java.exe','node.exe') {" ^
  "   $parent = Get-CimInstance Win32_Process -Filter \"ProcessId=$($p.ParentProcessId)\";" ^
  "   Write-Host ('  arret ' + $p.Name + ' PID ' + $_);" ^
  "   & taskkill.exe /f /t /pid $_ 2>$null | Out-Null;" ^
  "   if ($parent -and $parent.Name -in 'java.exe','node.exe') { & taskkill.exe /f /t /pid $parent.ProcessId 2>$null | Out-Null } } }"
REM laisse aux ports le temps de se liberer
timeout /t 2 /nobreak >nul
exit /b 0
