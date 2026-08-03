# Desktop Deployment

This directory holds the desktop-style deployment flow for
`nexus-n3-neia-app-framework` on Linux, Windows, and macOS.

The current target is not a native thick client. It is a local daemon-style web
application:

- a local service runs `neia-api`
- the service serves the compiled `neia-ui`, including the built-in Nexus N3
  session workflow
- users access the framework in a normal browser on `localhost`
- `apps/registry` contains optional applications only
- saved Nexus N3 workflows are mutable runtime data, separate from installed
  application files

## Current scope

Both platforms have two paths:

- local developer daemon scripts for testing from the repo checkout
- an installed desktop daemon and browser launcher

## Local Linux run

Use the helper scripts in [`linux`](./linux):

- `start_local_daemon.sh`
- `stop_local_daemon.sh`
- `status_local_daemon.sh`

Default behavior:

- binds to `127.0.0.1:8080`
- rebuilds and serves the single refactored `neia-ui` bundle by default
- uses the current registry under `apps/registry`
- seeds installed apps from `apps/installed.json`
- reads and writes workflows under the checkout's `workflows` directory
- writes runtime state under `deployment/desktop/.runtime/linux-local`

Set `NEIA_SKIP_UI_BUILD=1` to reuse an existing `neia-ui/dist` build. The start
script refuses to run if `dist/index.html` is absent.

The helper also verifies that the daemon survives startup. If port `8080` is
already owned by an older installed NEIA service, stop it before starting the
checkout daemon:

```bash
sudo systemctl stop nexus-n3-neia-app-framework.service
```

Alternatively, use a different local port, for example
`NEIA_PORT=8081 ./deployment/desktop/linux/start_local_daemon.sh`.

## Linux installed service model

The files in [`linux`](./linux) now also define a concrete installed-service
flow:

- `install_linux_desktop.sh`
- `uninstall_linux_desktop.sh`
- `nexus-n3-neia-app-framework.service`
- `open-neia.sh`
- `neia.desktop`
- `neia-desktop.env.example`

This is the intended shape of a downloadable Linux package:

1. package contents are installed under `/opt/nexus-n3-neia-app-framework`
2. mutable state is stored under `/var/lib/nexus-n3-neia-app-framework`
3. logs are stored under `/var/log/nexus-n3-neia-app-framework`
4. config is stored under `/etc/nexus-n3-neia-app-framework`
5. a `systemd` service is installed and started
6. a launcher opens the browser to `http://127.0.0.1:8080`

At the moment, the installer script is still intended to be run from a prepared
bundle or source checkout. A future `.deb`, `.rpm`, or graphical installer would
wrap this same file layout and service behavior.

For Ubuntu specifically, `.deb` is the native package format. It is the most
likely final packaging target for this Linux deployment path, not a mismatch.
The current scripts are the lower-level install logic that a future `.deb`
package would execute during install and upgrade.

## Installer behavior

The Linux installer now supports a few basic operational modes:

- default install/update: preserves existing app data and keeps the current env file
- `--force-env`: overwrite the installed env file from the example template
- `--rebuild-venv`: recreate the application virtualenv
- `--skip-ui-build`: package the existing `neia-ui/dist` without rebuilding it
- `--no-start`: install/update without restarting the service

The installer prefers a built wheel from `neia-api/dist/*.whl` when one exists.
If no wheel is present, it falls back to installing from the copied source tree.
The current wheel does not vendor third-party Python dependencies, so the target
machine needs network access while `pip` creates the runtime virtualenv.

## Uninstall behavior

The uninstaller supports:

- default uninstall: remove service, installed code, config, state, and logs
- `--keep-data`: remove service and installed code but keep `/var/lib` and `/var/log`

## Runtime layout

The Linux local scripts create a local runtime root with separate concerns:

- `state/`: mutable state such as `installed.json`
- `logs/`: daemon logs
- `run/`: PID file
- `workflows/`: saved built-in Nexus N3 workflow configurations (system installs)

That separation mirrors the eventual packaged layout, where install content and
mutable runtime state should not be mixed together.

For a system install, the intended split is:

- `/opt/nexus-n3-neia-app-framework`: installed application files
- `/var/lib/nexus-n3-neia-app-framework`: mutable app state, including installed app list
- `/var/log/nexus-n3-neia-app-framework`: daemon logs
- `/etc/nexus-n3-neia-app-framework`: environment and service config

## Important environment variables

- `NEIA_CONTENT_ROOT`
- `NEIA_REGISTRY_DIR`
- `NEIA_INSTALLED_FILE`
- `NEIA_STATE_DIR`
- `NEIA_LOG_DIR`
- `NEIA_RUN_DIR`
- `NEIA_WORKFLOWS_DIR`
- `NEIA_HOST`
- `NEIA_PORT`

## Windows local run

Use the PowerShell helpers in [`windows`](./windows):

- `start_local_daemon.ps1`
- `stop_local_daemon.ps1`
- `status_local_daemon.ps1`

From PowerShell at the repository root:

```powershell
& .\deployment\desktop\windows\start_local_daemon.ps1
& .\deployment\desktop\windows\status_local_daemon.ps1
& .\deployment\desktop\windows\stop_local_daemon.ps1
```

The local Windows runtime is stored under
`deployment/desktop/.runtime/windows-local`. As on Linux, the UI is rebuilt by
default; pass `-SkipUiBuild` to reuse the existing bundle.

## Windows installed desktop model

Run the installer from an elevated Windows PowerShell window:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
& .\deployment\desktop\windows\install_windows_desktop.ps1
```

The installer:

1. builds the refactored `neia-ui`
2. installs immutable files under `C:\Program Files\Nexus N3 NEIA`
3. stores state, logs, and workflows under `C:\ProgramData\Nexus N3 NEIA`
4. creates a Python virtual environment and installs `neia-api`
5. registers a `Nexus N3 NEIA` Scheduled Task at user logon
6. adds a desktop shortcut for the installing user that starts the task and opens the UI

Task Scheduler is used because an ordinary Python console process does not
implement the Windows Service Control Manager protocol. This provides the same
desktop-daemon lifecycle without requiring a third-party service wrapper.

Installer switches mirror Linux behavior:

- `-NoStart`
- `-ForceEnv`
- `-RebuildVenv`
- `-SkipUiBuild`

To uninstall while retaining saved workflows and other runtime state:

```powershell
& .\deployment\desktop\windows\uninstall_windows_desktop.ps1 -KeepData
```

The example Windows dotenv configuration is
[`windows/neia-desktop.env.example`](./windows/neia-desktop.env.example).

## Windows `.exe` packaging

The installable Windows package is built with Inno Setup 6 using:

```powershell
& .\deployment\desktop\windows\installer\build_windows_installer.ps1
```

The builder:

- rebuilds `neia-ui`, including built-in Nexus N3
- rebuilds the `neia-api` wheel
- stages only release content, excluding `node_modules`, source-only optional UI
  directories, virtualenvs, caches, and the local Ollama model store
- compiles `Nexus-N3-NEIA-Setup-<version>.exe` under
  `deployment\desktop\windows\dist`

Build prerequisites are Python 3.10+, the Python `build` package, Node/npm, and
Inno Setup 6. Use `-SkipUiBuild` or `-SkipApiBuild` only when the corresponding
existing artifact is known to be current. `-IsccPath` can locate a nonstandard
Inno Setup installation.

The target Windows machine needs Python 3.10+ on `PATH` and network access for
third-party Python packages. The installer treats a failed PowerShell/runtime
configuration as an installation failure instead of reporting false success.

## macOS local run

Use the shell helpers in [`macos`](./macos):

```bash
./deployment/desktop/macos/start_local_daemon.sh
./deployment/desktop/macos/status_local_daemon.sh
./deployment/desktop/macos/stop_local_daemon.sh
```

The local runtime is stored under `deployment/desktop/.runtime/macos-local`.
The refactored `neia-ui` is rebuilt by default; set `NEIA_SKIP_UI_BUILD=1` only
when the existing build is current.

## macOS `.pkg` packaging

Build the installable macOS package on a Mac with:

```bash
./deployment/desktop/macos/pkg/build_pkg.sh
```

The builder creates `deployment/desktop/macos/dist/Nexus-N3-NEIA-<version>.pkg`.
It builds a standard application bundle under `/Applications`, configures a
per-user LaunchAgent, and stores mutable runtime content in:

- `~/Library/Application Support/Nexus N3 NEIA`
- `~/Library/Logs/Nexus N3 NEIA`
- `~/Library/LaunchAgents/com.rsnexus.neia.plist`

This keeps saved workflows and optional-app state outside the signed/static
application payload. The application launcher starts the agent and opens NEIA
at `http://127.0.0.1:8080`.

Build prerequisites are macOS 12+, Python 3.10+, the Python `build` package,
Node/npm, and the standard Apple `pkgbuild`, `productbuild`, `plutil`, and
`rsync` tools. Pass `--sign "Developer ID Installer: ..."` to sign with an
available Installer certificate. Distribution outside a controlled test
environment also requires Apple notarization.

The target Mac needs Python 3.10+ and network access while the installer creates
the per-user virtualenv. Package installation requires a logged-in desktop user
because the LaunchAgent belongs to that user.

After installing the package, validate the complete target-host contract with:

```bash
"/Applications/Nexus N3 NEIA.app/Contents/Resources/deployment/desktop/macos/test_macos_target.sh"
```

The test checks the application bundle, LaunchAgent, health endpoint, compiled
refactored UI, workflow storage, and removal of the legacy optional `nexus`
entry.

Manual uninstall, preserving saved data:

```bash
sudo "/Applications/Nexus N3 NEIA.app/Contents/Resources/deployment/desktop/macos/uninstall_macos_desktop.sh" --keep-data
```

## Next steps

The next packaging layer should add:

- `.rpm` packaging around the Linux install assets
- signing for the Windows `.exe`, or an MSI/MSIX distribution wrapper
- Apple notarization for public macOS distribution
- app upload/import flow on top of the existing registry model

## Ubuntu `.deb` packaging

Ubuntu uses `.deb` as its native package format. The Debian packaging assets now
live under [`linux/deb`](./linux/deb):

- `build_deb.sh`
- `control`
- `postinst`
- `prerm`
- `postrm`
- `conffiles`
- `neia.metainfo.xml`

The `.deb` builder rebuilds `neia-ui/dist` from the current frontend source by
default before packaging. This avoids shipping stale UI bundles that do not
match the checked-out source code, including the built-in Nexus N3 workflow.

The intended UX on Ubuntu is:

- the user downloads a `.deb`
- they open it with Ubuntu App Center or another GUI package installer
- Ubuntu shows the normal install progress UI
- after install, the app appears as a launchable desktop application
- launching it opens the NEIA UI in the browser on `localhost`

Important constraint:

The `.deb` package can integrate with the Ubuntu software UI through desktop and
AppStream metadata, but it does not control a custom wizard-style installation
window. The visible progress and any "Launch" action come from the Ubuntu GUI
installer, not from arbitrary package code.

## Package icon

All desktop packaging should use the shared icon directory under:

- [`icon/NX_icon_dark.png`](./icon/NX_icon_dark.png)

That file is copied into the package as the app icon and referenced by both:

- the desktop launcher entry
- the AppStream metadata used by GUI software installers

During `.deb` build, the shared logo is automatically padded onto a square
transparent canvas so it behaves like a proper Ubuntu app icon even if the
source artwork is a wide banner.

To change the icon, replace the shared file in `deployment/desktop/icon/` and
rebuild the `.deb`.
