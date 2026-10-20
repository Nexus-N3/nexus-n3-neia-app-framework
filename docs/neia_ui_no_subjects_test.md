# NEIA UI Test: Subject And Session Config API Flows

This note covers the main NEIA UI test cases when using the `neia-api` directly:

- add subjects
- add session configs
- clear subjects
- clear session configs
- verify fallback to ad hoc dashboard mode

## Prerequisite

Start `neia-api`:

```bash
cd /home/mike/Desktop/apps/dev/rs-nexus-project/nexus-n3-neia-app-framework/neia-api
env PYTHONPATH=. python -m app.daemon --reload --host 0.0.0.0 --port 8080
```

## Add Subjects

```bash
curl -X POST http://localhost:8080/api/v1/control-center/messages \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "subject_catalog_update",
    "target": "neia",
    "payload": {
      "customer_id": "customer-dlr",
      "site_id": "local_home",
      "groups": [
        {
          "group_id": "iss_astronauts",
          "label": "ISS Astronauts",
          "subjects": [
            {
              "subject_id": "astronaut-a",
              "display_name": "Astronaut A",
              "subject_type": "astronaut"
            },
            {
              "subject_id": "astronaut-b",
              "display_name": "Astronaut B",
              "subject_type": "astronaut"
            }
          ]
        }
      ]
    }
  }'
```

Expected UI behavior:

- if NEIA is idle on the dashboard, it should move to subject selection
- if NEIA is inside an app, it should not interrupt the app

## Add Session Configs

```bash
curl -X POST http://localhost:8080/api/v1/control-center/messages \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "session_config_update",
    "target": "neia",
    "payload": {
      "customer_id": "customer-dlr",
      "site_id": "local_home",
      "session_configs": [
        {
          "session_config_id": "cfg-demo-walking-nexus",
          "name": "Walking Demo",
          "app_id": "nexus",
          "app_name": "Nexus Session Management",
          "subject_ids": ["astronaut-a", "astronaut-b"],
          "activity": "walking",
          "workflow": {
            "setup_id": "default",
            "algorithm_name": "standard_loading_intensity",
            "sensors": [
              {
                "local_name": "Movella DOT",
                "number_of": 2,
                "compute_algorithm": {
                  "name": "standard_loading_intensity",
                  "inputs": {}
                },
                "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"]
              }
            ]
          },
          "subjects": [
            {
              "subject_id": "astronaut-a",
              "display_name": "Astronaut A",
              "subject_type": "astronaut",
              "sensors": [
                {
                  "local_name": "Movella DOT",
                  "number_of": 2,
                  "compute_algorithm": {
                    "name": "standard_loading_intensity",
                    "inputs": {}
                  },
                  "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"]
                }
              ]
            },
            {
              "subject_id": "astronaut-b",
              "display_name": "Astronaut B",
              "subject_type": "astronaut",
              "sensors": [
                {
                  "local_name": "Movella DOT",
                  "number_of": 2,
                  "compute_algorithm": {
                    "name": "standard_loading_intensity",
                    "inputs": {}
                  },
                  "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"]
                }
              ]
            }
          ],
          "init_payload": {
            "init_label": "Walking Demo",
            "app_id": "nexus",
            "app_name": "Nexus Session Management",
            "subjects": [
              {
                "subject_id": "astronaut-a",
                "sensors": [
                  {
                    "local_name": "Movella DOT",
                    "number_of": 2,
                    "compute_algorithm": {
                      "name": "standard_loading_intensity",
                      "inputs": {}
                    },
                    "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"]
                  }
                ]
              },
              {
                "subject_id": "astronaut-b",
                "sensors": [
                  {
                    "local_name": "Movella DOT",
                    "number_of": 2,
                    "compute_algorithm": {
                      "name": "standard_loading_intensity",
                      "inputs": {}
                    },
                    "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"]
                  }
                ]
              }
            ]
          }
        }
      ]
    }
  }'
```

Expected UI behavior:

- no forced navigation by itself
- once a subject is selected, matching configs should appear on the session-config screen

## Clear Subjects

```bash
curl -X POST http://localhost:8080/api/v1/control-center/messages \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "subject_catalog_update",
    "target": "neia",
    "payload": {
      "customer_id": "customer-dlr",
      "site_id": "local_home",
      "groups": []
    }
  }'
```

Expected UI behavior:

- if NEIA is not inside an app, it should return to the dashboard
- subject selection should no longer be shown

## Clear Session Configs

```bash
curl -X POST http://localhost:8080/api/v1/control-center/messages \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "session_config_update",
    "target": "neia",
    "payload": {
      "customer_id": "customer-dlr",
      "site_id": "local_home",
      "session_configs": []
    }
  }'
```

Expected UI behavior:

- no forced navigation
- session-config choices should disappear from the shell state

## Open NEIA

Open:

```text
http://localhost:8080
```

## Expected Result

- no subject-selection screen is shown
- no session-config screen is shown
- NEIA goes straight to the standard dashboard in ad hoc mode

## Optional Verification

Confirm backend state:

```bash
curl http://localhost:8080/api/v1/control-center/catalog
```

Expected response shape:

```json
{
  "groups": [],
  "session_configs": []
}
```
