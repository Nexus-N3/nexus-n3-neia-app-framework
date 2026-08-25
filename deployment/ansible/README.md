# Nexus N3 NEIA App Framework Ansible Deployment

This deploys the NEIA API + static UI assets to the standalone/master device and runs the packaged NEIA daemon as a systemd service on port `8080`.

The deployment model now matches `nexus-n3-core`:

- build the NEIA API wheel locally first
- build the dashboard UI locally first
- build each app UI into `apps/registry/*/ui/assets`
- deploy the wheel artifact plus synced runtime content
- keep mutable state under `/var/lib/nexus-n3-neia-app-framework`
- keep service configuration under `/etc/nexus-n3-neia-app-framework`

## Prereqs (local)

- Build the UI assets before deploying:
  - `nexus-n3-neia-app-framework/neia-ui/dist` must exist
- Build the API wheel before deploying:
  - `nexus-n3-neia-app-framework/neia-api/dist/nexus_n3_neia_api-<version>-py3-none-any.whl` must exist
  - App template bundles should already be built in `apps/registry/*/ui/assets`

Build the wheel from the repo root:

```bash
cd nexus-n3-neia-app-framework/neia-api
python3 -m build --wheel
```

## Inventory

Edit `deployment/ansible/inventory/hosts.ini` if needed:

```
[master]
nexus-n3-master.local ansible_user=rsnexus
```

## Deploy

From the repo root:

```
cd nexus-n3-neia-app-framework/deployment/ansible
ansible-playbook site.yml
```

This playbook now:

- discovers the newest locally built wheel artifact unless `neia_release_local_path` is explicitly set
- syncs only the runtime artifacts needed on the target:
  - `neia-ui/dist`
  - `apps/installed.json`
  - app manifests, icons, and `ui/assets`
  - `shared/steps.json`
  - `docs/`
- skips `models/` during normal release syncs
- uploads the wheel to `/tmp/`
- force-reinstalls the wheel into the target virtualenv
- refreshes the systemd environment and daemon-style service unit when needed
- preserves installed-app, workflow, and gateway state across release updates

## Runtime Configuration

The deployed service is configured by Ansible vars, not by a copied local `.env`
file.

- `.env` and `neia-api/.env` are excluded from deployment sync
- systemd environment variables from `neia_service_env` are the deployed source
  of truth
- local `.env` remains a development-only convenience

Voice is disabled by default in the deployed service:

- `neia_voice_enabled: false`
- `neia_voice_tts_enabled: false`

That means an edge box without a speaker or Piper model can still run NEIA
cleanly.

Large voice/STT model assets are not synced by default during release deploys:

- `neia_sync_models: false`

That keeps normal deploys fast even when `models/` is very large.

If the target actually needs refreshed local models, enable a one-off model sync:

```bash
ansible-playbook -i inventory/hosts.ini site.yml \
  --limit nexus-n3-master.local \
  -e neia_sync_models=true
```

The Ansible role now exposes the full runtime env surface used by the API,
including:

- gateway selection and master-discovery settings
- voice/STT/TTS parameters
- packaged content-root selection

If you do want voice on a target, set host or group vars explicitly, for
example:

```yaml
neia_voice_enabled: true
neia_voice_tts_enabled: true
neia_voice_device: pulse
neia_voice_tts_piper_model: /opt/nexus-n3-neia-app-framework/models/piper/en_GB-southern_english_female-low.onnx
```

## Service

```
sudo systemctl status nexus-n3-neia-app-framework
sudo systemctl restart nexus-n3-neia-app-framework
```

## Optional Kiosk Mode

Kiosk provisioning belongs to this NEIA deployment. It is disabled by default
because it configures GDM autologin, disables desktop sleep/locking, and starts
Chromium automatically. Enable it for an appliance with a local display:

```bash
ansible-playbook -i inventory/hosts.ini site.yml \
  --limit nexus-n3-master.local \
  -e neia_kiosk_enabled=true
```

The kiosk defaults to the SSH/Ansible account and opens
`http://localhost:8080`. Override `neia_kiosk_user` or `neia_kiosk_url` when
needed. The user service and launcher retain their existing
`nexusn3-kiosk.service` and `nexusn3-kiosk.sh` names so devices previously
provisioned by the Core role are upgraded in place rather than running two
browsers.

## Common Overrides

```
ansible-playbook site.yml --limit master \
  --extra-vars "neia_install_root=/home/rsnexus/nexus-n3-neia-app-framework neia_port=8080 neia_dev=0"
```
