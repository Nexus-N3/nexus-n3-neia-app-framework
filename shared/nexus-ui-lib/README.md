# Nexus UI Lib

Reusable Nexus UI parts for apps inside the `nexus-n3-neia-app-framework` framework.

This package is intentionally not an app. It exposes a reusable subset of the Nexus UI so
other apps can compose their own flows without inheriting the full shell.

Current export groups:
- `components`
- `hooks`

Notes:
- The library excludes Nexus app state, stylesheets, static assets, and screens.
- Only self-contained components and command/socket hooks are exported here.
- `nexus/ui` remains the reference app and has not been switched to consume this library yet.
