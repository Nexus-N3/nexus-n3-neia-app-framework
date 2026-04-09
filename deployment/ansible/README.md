# NEIA Ansible Deployment

This deploys the NEIA API + static UI assets to the standalone/master device and runs the API as a systemd service on port `8050`.

## Prereqs (local)

- Build the UI assets before deploying:
  - `rs-nexus-neia/neia-ui/dist` must exist
  - App template bundles should already be built in `apps/registry/*/ui/assets`

## Inventory

Edit `deployment/ansible/inventory/hosts.ini` if needed:

```
[master]
rs-nexus-master.local ansible_user=rsnexus
```

## Deploy

From the repo root:

```
cd rs-nexus-neia/deployment/ansible
ansible-playbook site.yml
```

## Service

```
sudo systemctl status rs-nexus-neia
sudo systemctl restart rs-nexus-neia
```

For standalone deployments that also use the `rs-nexus-os` kiosk role, point the
kiosk at NEIA:

```yaml
nexus_kiosk_url: http://localhost:8050
```

## Common Overrides

```
ansible-playbook site.yml --limit master \
  --extra-vars "neia_install_root=/home/rsnexus/rs-nexus-neia neia_port=8050 neia_dev=0"
```
