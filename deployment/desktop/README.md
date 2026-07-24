# Desktop Deployment

This directory holds the first-pass "desktop-style" deployment flow for
`nexus-n3-neia-app-framework`.

The current target is not a native thick client. It is a local daemon-style web
application:

- a local service runs `neia-api`
- the service serves the existing `neia-ui`
- users access the framework in a normal browser on `localhost`
- the current `apps/registry` remains the app source for now

## Current scope

The implementation is Linux-first.

There are now two Linux paths:

- local developer daemon scripts for testing from the repo checkout
- a first system-install path that models what a downloaded package would do

Windows and macOS packaging can follow once the local daemon shape is stable.

## Local Linux run

Use the helper scripts in [`linux`](./linux):

- `start_local_daemon.sh`
- `stop_local_daemon.sh`
- `status_local_daemon.sh`

Default behavior:

- binds to `127.0.0.1:8080`
- serves content from the current repo checkout
- uses the current registry under `apps/registry`
- seeds installed apps from `apps/installed.json`
- writes runtime state under `deployment/desktop/.runtime/linux-local`

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
- `--no-start`: install/update without restarting the service

The installer prefers a built wheel from `neia-api/dist/*.whl` when one exists.
If no wheel is present, it falls back to installing from the copied source tree.

## Uninstall behavior

The uninstaller supports:

- default uninstall: remove service, installed code, config, state, and logs
- `--keep-data`: remove service and installed code but keep `/var/lib` and `/var/log`

## Runtime layout

The Linux local scripts create a local runtime root with separate concerns:

- `state/`: mutable state such as `installed.json`
- `logs/`: daemon logs
- `run/`: PID file

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
- `NEIA_HOST`
- `NEIA_PORT`

## Next steps

The next packaging layer should add:

- `.deb` and/or `.rpm` packaging that wraps the current install assets
- Windows installer/service packaging
- macOS app/service packaging
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
match the checked-out source code.

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
