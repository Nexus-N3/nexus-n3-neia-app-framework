Client Message Flow
This guide describes the command/event flow from server readiness through
starting and stopping data collection. It is intended for application teams
building a control client.
User Flow:

The Application is deployed to the edge device and operates in offline mode 

notes:

There is currently no persistence across usages

i.e each use is fresh 

its a good idea to purge messages queues (when using lavinmq) from the client side

Step 0: Server Readiness 

The app should ask if the server is ready.  In doing so the app knows that the core interface is ready to accept and handle messages. 

The EVT_SERVER_READYis returned which, when the server is ready, contains supported sensors, supported algorithms and supported gateways. 

Step 1: Who and Session (Session file name)

App provides a means to set the top level session in the format who_session e.g Anna_baseline_data_collection

Step 2: Subjects 

App creates subjects which are unique id for the number of sensors.  Could be Subject_0, subject_1, subject_2.  Could be a base name like “anna_subject” and a number selected that creates anna_subject_0, anna_subject_1 etc. 

How many subjects are to be used in this session?

In the case that subjects are used across multiple usages what should be done?  for example, day 1 subject_0 is created and captured. day 2 subject 1 needs to be captured? 

Step 3: Sensors

For the subjects that are being captured in this session sensors must be assigned to the subject.  Currently this is only “Movella Dot”  (This must match the local_name property used in CMD_INIT_SYSTEM).  

(supported sensors are returned in the system ready event with the correct local_name)

Step 4: Locations

Locations must be selected (i.e LEFT_ANKLE, RIGHT_ANKLE).  

(locations are returned as part of the supported sensors in system server ready event)

Step 5: Algorithms

Each sensor for a subject can have an algorithm assigned to it.  the base use case is that all SAME sensor types (i.e Movella Dot) have the same algorithm assigned.  

Algorithms can be assigned to a single sensor type. 

At this stage the CMD_INIT_SYSTEM should be built and can be sent to the edge

Step 6: Discover

Sensors can be discovered for ALL subjects at once or for a selected subject.  there is no payload for this action other than an id if discovering a single subject.  

Discovery pre assigns sensors to locations on the edge 

Step 7: Connect

Subjects must be connected and this can also be done by connecting to all subjects (assuming all have been discovered) or by subject.  Again only an id is required to connect a given subject else no payload is required.

(pre-assigned locations are returned in the connected sensor event payload) 

Step 8: Identify (to assign body locations)

For each subject to be captured sensors must be assigned to the locations.  During previous steps the edge has pre assigned sensors to locations.  This step involves cycling through subjects and locations to send the identify command.  Sensors should be physically placed at this stage.

Step 9: Start / Stop streaming and View Live Results

Streaming can be initiated on all connected subjects or individually.  A tag can be provided for each subject or group of subjects.  If this tag is not included then the system will create a generic sys tag.

the start stream command is initiated.

Captured data is returned in EVT_COMPUTE_RESULT and EVT_INTERMEDIATE_RESULT

This screen should display a grid of subjects (4 max) of live results and should allow the selection of a given subject to view both live results and intermediate results.  This is bear minimum results which in all cases. 

Real time result example



{'type': 'compute_result', 
'payload': {'subject_id': 'subject1', 
'result': {'address': 'D4:22:CD:00:AA:6F', 'stage': 'real_time', 'result_count': 3, 
'frequency_band_results': [{'band_name': '0-3', 'axis_values': {'x': 0.0019220005296488448, 'y': 0.0018758085432429884, 'z': 0.002804113360199098, 'mag': 0.0027974426799912966}}, {'band_name': '3-6', 'axis_values': {'x': 0.00513805255458173, 'y': 0.00507945280066177, 'z': 0.008087229271177427, 'mag': 0.008094373085256068}}, {'band_name': '6-10', 'axis_values': {'x': 0.011293386350253426, 'y': 0.011318532170194523, 'z': 0.020312697012150778, 'mag': 0.020384350874871122}}, {'band_name': '0-6', 'axis_values': {'x': 0.006947627573245599, 'y': 0.006785958208901943, 'z': 0.010830979121048837, 'mag': 0.010832719867964706}}], 'algorithm_name': 'standard_loading_intensity'}, 
'location': 'RIGHT_ANKLE', 'algorithm_name': 'standard_loading_intensity'}, 
'site': 'my_house'}
Intermediate result example



{'type': 'intermediate_result', 
'payload': {'subject_id': 'subject1', 'algorithm_name': 'standard_loading_intensity', 
'stage': 'intermediate_time', 
'results': [
{'address': 'D4:22:CD:00:AA:6F', 'data': {'0-3': {'x': 0.0015444987677820756, 'y': 0.0017639998608787637, 'z': 0.004025871388238662, 'mag': 0.00403304378699944}, '3-6': {'x': 0.005280302174629683, 'y': 0.005560256099838765, 'z': 0.00937875764823176, 'mag': 0.009393792315621425}, '6-10': {'x': 0.011737868808815183, 'y': 0.012243095561670463, 'z': 0.02085334897406594, 'mag': 0.020889388949894973}, '0-6': {'x': 0.0067655973902081, 'y': 0.0071637873238154515, 'z': 0.012913718768561169, 'mag': 0.012936650917722788}}}, 
{'address': 'D4:22:CD:00:A8:D2', 'data': {'0-3': {'x': 0.0021373920735403475, 'y': 0.0021161345206661773, 'z': 0.002914524198185619, 'mag': 0.002913720448481443}, '3-6': {'x': 0.005492145873703027, 'y': 0.006726440782013366, 'z': 0.008374407264961626, 'mag': 0.008386698183693354}, '6-10': {'x': 0.013019686502998222, 'y': 0.013753846238571526, 'z': 0.02213728173879478, 'mag': 0.022114827706318632}, '0-6': {'x': 0.007423842286766881, 'y': 0.008709992364335176, 'z': 0.011097384862223579, 'mag': 0.0111082826940933}}}]}, 
'site': 'my_house'}
Stop Streaming can be stopped on all subjects or individually.

Step 11: View Final Results

(only viewable when all subjects are stopped)

Step 12: Repeat or Re initialize

Repeat:  for the same connected subjects new captures can be done

Re Initialize: Start from the beginning for new subjects

Message Types
rs_nexus_gateway.messaging.message_types.

This module defines all commands that clients can send to the system
and all events that the system emits back. These constants are used
by Server, MessageHandler, gateways, and clients to ensure consistent
message passing.

System Command Reference (from message_types.py)

CMD_IS_SERVER_READY = "is_server_ready"
CMD_SYSTEM_SETUP = "system_setup"
CMD_INIT_SYSTEM = "init_system"
CMD_DISCOVER_SENSORS = "discover_sensors"
CMD_DISCOVER_SENSORS_FOR_SUBJECTS = "discover_sensors_for_subjects"
CMD_CONNECT_TO_ALL = "connect_all"
CMD_CONNECT_SUBJECTS = "connect_subjects"
CMD_DISCONNECT_ALL = "disconnect_all"
CMD_DISCONNECT_SUBJECTS = "disconnect_subjects"
CMD_IDENTIFY_SENSOR = "identify_sensor"
CMD_START_STREAM_FOR_ALL = "start_stream_for_all"
CMD_START_STREAM_FOR_SUBJECTS = "start_stream_for_subjects"
CMD_STOP_STREAM_FOR_ALL = "stop_stream_for_all"

CMD_STOP_STREAM_FOR_SUBJECTS = "stop_stream_for_subjects"

used internally (not by clients)

CMD_UPDATE_FILE_PATH = "update_file_path"

System Event Reference (from message_types.py)
EVT_SERVER_READY

EVT_SYSTEM_INITIALIZED

EVT_SENSORS_DISCOVERED

EVT_SENSORS_DISCOVERED_FOR_SUBJECT

EVT_SENSOR_CONNECTED

EVT_SENSOR_DISCONNECTED

EVT_STREAM_STARTED

EVT_STREAM_STOPPED

EVT_SENSOR_IDENTIFIED

EVT_SENSOR_MANGER_INITIALISED

EVT_COMPUTE_RESULT

EVT_INTERMEDIATE_RESULT

EVT_ERROR

Used in internally not by clients

EVT_USB_DISK_INSERTED

EVT_USB_DISK_REMOVED

Common Fields
type (string): Message type constant 

payload (object): Optional data for the command or event.

Client Message Flow
This guide describes the command/event flow and documents all message types
defined in message_types.py. It is intended for application teams building
a control client.

Common Fields
type (string): Message type constant from rs_nexus_gateway.messaging.message_types.

payload (object): Optional data for the command or event.

1. Readiness and Initialization
Client -> CMD_IS_SERVER_READY

Payload: none

Server Response -> EVT_SERVER_READY

Payload: 




  "type": "server_ready",
  "payload": {
    "msg": "System Server Ready",
    "site": "my_house",
    "supported_sensors": [
      {
        "name": "Movella DOT",
        "locations": [
          "HEAD",
          "LOWER_BACK",
          "LEFT_ANKLE",
          "RIGHT_ANKLE",
          "LEFT_THIGH",
          "RIGH_THIGH",
          "CHEST",
          "UPPER_BACK"
        ],
        "computations": [
          {
            "name": "standard_loading_intensity",
            "inputs": {
              "gravity": 9.80665
            }
          }
        ]
      },
      {
        "name": "Movesense",
        "locations": [
          "CHEST"
        ],
        "computations": []
      },
      {
        "name": "USB Camera",
        "locations": [
          "STARLAB"
        ],
        "computations": []
      }
    ],
    "supported_gateways": [
      "lavinmq_gateway",
      "rabbitmq_gateway",
      "zeromq_gateway"
    ]
  },
  "site": "my_house"
}
 or "System Server NOT Ready"

Client -> CMD_INIT_SYSTEM

Payload:

subjects (required): list of subject configs

init_label (optional): top-level session label (client should include any
"who_" prefix; system appends a timestamp)

If init_label is missing, system uses sys_session_<ts>.

Example:



{
  "type": "init_system",
  "payload": {
    "init_label": "Anna_bdc",
    subjects = [
       {
            "subject_id": "subject1",
            "sensors": [
                {
                    "local_name": "Movella DOT", 
                    "number_of": 2,
                    "compute_algorithm": 
                        { 
                            "name": "standard_loading_intensity",
                            "inputs": {
                                "gravity": 9.80665
                            }
                        },
                    "locations": ["LEFT_ANKLE", "RIGHT_ANKLE"],
                }
            ],
        },
    ]
  }
}
Server Response -> EVT_SYSTEM_INITIALIZED

Payload: status string (e.g., "System initialised with 1 subject(s)")

Discovery
Discover all sensors tries to discover all the required sensors for all subjects

Client -> CMD_DISCOVER_SENSORS

Payload: none

Server Response -> EVT_SENSORS_DISCOVERED

Payload: list of subjects with discovered sensors.



{'type': 'sensors_discovered', 'payload': [{'subject_id': 'subject1', 'discovered_sensors': ['D4:22:CD:00:AA:6F', 'D4:22:CD:00:A8:D2']}], 'site': 'my_house'}
Discover sensors for a given subject only discovers for a subject id

Client -> CMD_DISCOVER_SENSORS_FOR_SUBJECTS

Payload:

[subject_ids]  list of (required)

Server Response -> EVT_SENSORS_DISCOVERED_FOR_SUBJECT

Payload: discovery info for the specific subject.

Connection
Client -> CMD_CONNECT_TO_ALL or CMD_CONNECT_SUBJECT

CMD_CONNECT_SUBJECTS payload:

[subject_ids] List of (required)

Server Response -> EVT_SENSOR_CONNECTED



{'type': 'sensor_connected', 'payload': [{'subject_id': 'subject1', 'connected_sensors': ['D4:22:CD:00:AA:6F (CONNECTED)', 'D4:22:CD:00:A8:D2 (CONNECTED)']}], 'site': 'my_house'}
Identify
Client -> CMD_IDENTIFY_SENSOR

Payload:

subject_id (required)

location (required)

Server Response → None

Sensors will flash red for 10 seconds

Start Streaming (Tagging)
Client -> CMD_START_STREAM_FOR_ALL

Payload (optional):

tag: apply to all subjects

tags: map of subject_id -> tag (per-subject override)

If tags are missing:

Tag defaults to sys

Tag directory becomes sys_<ts>

Example:



{
  "type": "start_stream_for_all",
  "payload": { "tag": "run" }
}
Per-subject tags:



{
  "type": "start_stream_for_all",
  "payload": {
    "tags": {
      "subject1": "run",
      "subject2": "walk"
    }
  }
}
Client -> CMD_START_STREAM_FOR_SUBJECTs

Payload:

[subject_ids] list of (required)

tag (optional)

Server Response -> EVT_STREAM_STARTED



{'type': 'stream_started', 'payload': [{'subject_id': 'subject1', 'streaming_sensors': ['D4:22:CD:00:AA:6F', 'D4:22:CD:00:A8:D2']}], 'site': 'my_house'}
File Output Structure
Base directory:



rs_nexus_outputs/<site>/<init_label_or_sys_session_ts>/
Per subject: 

(there should be no need for the extra session_<session_ts>)



session_<session_ts>/<subject_id>/<tag_ts>/raw/<location>_<tag>_<ts>.csv
session_<session_ts>/<subject_id>/<tag_ts>/computed/.../<location>_<tag>_<ts>.ndjson
Notes:

init_label always receives a timestamp suffix.

tag_ts is the tag with a timestamp suffix (e.g., run_20250119_102030).

Filenames include location, tag, and timestamp.

Stop Streaming
Client -> CMD_STOP_STREAM_FOR_ALL

Payload: none

or

Client -> CMD_STOP_STREAM_FOR_SUBJECTS

Payload: [subject_ids] list of (required)

Server Response -> EVT_STREAM_STOPPED

Disconnect
Client -> CMD_DISCONNECT_ALL

Payload: none

Client ->CMD_DISCONNECT_SUBJECTS

Payload: [subject_ids] (required)

Server Response → EVT_SENSOR_DISCONNECTED



{'type': 'sensor_disconnected', 'payload': ['D4:22:CD:00:A8:D2', 'D4:22:CD:00:AA:6F'], 'site': 'my_house'}
Errors
Any command can emit EVT_ERROR with a payload string or dict describing the
failure.