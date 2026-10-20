## Workflows

Work flows are stored artifacts that users can save and load and export to share.

Primarily they represent the sensor and alogrithm combination of a session. 
 

## Subject Shape

configurations are indexed by subject when they are created. 

- single subject
{
  "Subject_1": [
    {
      "id": "sensor-1785473373123-1",
      "sensorType": "Movella DOT",
      "location": "HEAD",
      "algorithms": [
        "standard_loading_intensity"
      ]
    }
  ]
}

- two subjects

{
  Subject_1: [
    {
      id: 'sensor-1785473373123-1',
      sensorType: 'Movella DOT',
      location: 'HEAD',
      algorithms: ['standard_loading_intensity'],
    },
  ],
  Subject_2: [
    {
      id: 'sensor-1785473601140-2',
      sensorType: 'Movesense',
      location: 'CHEST',
      algorithms: ['ecg_rhythm_metrics'],
    },
  ],
};

The subject index (e.g Subject_2) could be changed by the user when this workflow is used. 

## Scenarios

A user defines a sensor / alogrithm combination for a single subject, this is then applied to all subjects in the subsequent sesssion that are present.  For example, the user chooses 2 subjects and loads the workflow.  The workflow is defined for one subject but is applied to the two that have been defined in the curent session

A user defines diffent sensor combinations for two subjects.  2 or a multiple of two subjects must be defined in the subsequent session to map the workflow to. if it does not map then it produces a import failure error

A user loads a workflow and then makes changes in the application (adds a new sensor / alogrithm combination).  This new workflow can be saved but does not overrite the original. 

## api

there needs to be 4 api endpoints: save, load, export and list workflows

Saving a workflow requires that subject indexes are mapped to something generic like s1, s2 etc.  A workflow should have a unique id, name and a last modified timestamp. 

loading a workflow must match the defined subjects in the application and map s1, s2 etc to these subject identifiers (as these are created by the user in the application).  The assumption is that the workflow created is compatible with the nexus-n3-core that it was built against. However, a compatability check should be run to ensure that the current n3 core system in use is also compatible. This is a check against sensors and alogrithms that are actually installed. 

exporting a workflow allws the user to save the workflow outside of the application to a destination they choose

listing workflows allows a view to be created that allows the exporting and deletion of workings. This will be added to the main menu.  Workflows cannot be imported here as the subjects will not have been defined.


