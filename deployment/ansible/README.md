# Nexus N3 NEIA App Framework Ansible Deployment

This deploys the NEIA API + static UI assets to the standalone/master device and runs the API as a systemd service on port `8050`.

The deployment model now matches `nexus-n3-core`:

- build the NEIA API wheel locally first
- build the dashboard UI locally first
- build each app UI into `apps/registry/*/ui/assets`
- deploy the wheel artifact plus synced runtime content

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

- checks that the local wheel artifact exists
- syncs only the runtime artifacts needed on the target:
  - `neia-ui/dist`
  - `apps/installed.json`
  - app manifests, icons, and `ui/assets`
  - `shared/steps.json`
  - `docs/`
- skips `models/` during normal release syncs
- uploads the wheel to `/tmp/`
- force-reinstalls the wheel into the target virtualenv
- refreshes the systemd unit when needed

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
- LavinMQ connection settings
- voice/STT/TTS parameters
- packaged content-root selection

Optional values such as `AMQP_URL` are only emitted into the systemd unit when
they are non-empty, so the default ZeroMQ deployment does not get polluted with
blank overrides.

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

For standalone deployments that also use the `rs-nexus-os` kiosk role, point the
kiosk at NEIA:

```yaml
nexus_kiosk_url: http://localhost:8050
```

## Common Overrides

```
ansible-playbook site.yml --limit master \
  --extra-vars "neia_install_root=/home/rsnexus/nexus-n3-neia-app-framework neia_port=8050 neia_dev=0"
```
