(function () {
  var FALLBACK_STEPS = [
    { id: "check_readiness", name: "Check Server Readiness", command: "is_server_ready" },
    { id: "who_session", name: "Who + Session Label" },
    { id: "subjects", name: "Subjects" },
    { id: "sensors", name: "Sensors" },
    { id: "locations", name: "Locations" },
    { id: "algorithms", name: "Algorithms" },
    { id: "init_system", name: "Init System", command: "init_system" },
    { id: "discover_sensors", name: "Discover Sensors", command: "discover_sensors" },
    { id: "connect_sensors", name: "Connect Sensors", command: "connect_all" },
    { id: "identify_sensors", name: "Identify Sensors (Assign Locations)", command: "identify_sensor" },
    { id: "start_stream", name: "Start Stream", command: "start_stream_for_all" },
    { id: "stop_stream", name: "Stop Stream", command: "stop_stream_for_all" },
    { id: "final_results", name: "View Final Results" },
    { id: "disconnect", name: "Disconnect Sensors", command: "disconnect_all" },
  ];

  var DEFAULT_PAYLOADS = {
    init_system: {
      init_label: "Anna_bdc",
      subjects: []
    },
    connect_subjects: { subject_ids: ["subject1"] },
    identify_sensor: { subject_id: "subject1", location: "LEFT_ANKLE" },
    start_stream_for_all: { tag: "run" },
    start_stream_for_subjects: { subject_ids: ["subject1"], tag: "run" },
    stop_stream_for_subjects: { subject_ids: ["subject1"] },
    disconnect_subjects: { subject_ids: ["subject1"] }
  };

  function jsonString(value) {
    return JSON.stringify(value, null, 2);
  }

  function getPayloadTemplate(command) {
    if (!command) return "";
    var preset = DEFAULT_PAYLOADS[command];
    if (!preset) return "";
    return jsonString(preset);
  }

  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  function mount(el) {
    if (!el) return;
    el.innerHTML = "";

    var container = createEl("div", "neia-template-app");

    var header = createEl("div", "header");
    var title = createEl("h2", null, "NEIA App Template");
    header.appendChild(title);
    header.appendChild(createEl("p", "hint", "This template includes the base steps and a simple command runner."));

    var layout = createEl("div", "layout");
    var nav = createEl("div", "steps");
    var content = createEl("div", "content");

    layout.appendChild(nav);
    layout.appendChild(content);
    container.appendChild(header);
    container.appendChild(layout);

    el.appendChild(container);

    var state = {
      steps: FALLBACK_STEPS,
      index: 0,
      events: [],
      completed: {},
      who: "",
      session_label: "",
      subject_base: "subject",
      subject_count: 1,
      sensor_name: "Movella DOT",
      sensor_count: 2,
      supported_sensors: [],
      supported_sensor_locations: {},
      supported_sensor_computations: {},
      site: "",
      subject_sensors: {},
      subject_locations: {},
      locations: ["LEFT_ANKLE", "RIGHT_ANKLE"],
      algorithm_subject_index: 0,
      algorithm_assign_mode: "all",
      subject_algorithms: {},
      algorithm_all_name: "standard_loading_intensity",
      algorithm_all_inputs: "{\n  \"gravity\": 9.80665\n}",
      discover_subject_index: 0,
      connect_subject_index: 0,
      identify_subject_index: 0,
      identify_location: "",
      stream_subject_index: 0,
      stop_subject_index: 0,
      result_view_subject_index: 0,
      result_counts: {},
      last_compute: {},
      last_intermediate: {}
    };

    function render() {
      nav.innerHTML = "";
      content.innerHTML = "";

      state.steps.forEach(function (step, idx) {
        var isActive = idx === state.index;
        var isComplete = !!state.completed[step.id];
        var canEnter = idx <= state.index || isComplete || isPrevStepsComplete(idx);
        var typeClass = step.command ? " command-step" : " input-step";
        var completeClass = isComplete ? (step.command ? " done-command" : " done-input") : "";
        var item = createEl(
          "div",
          "step" + typeClass + (isActive ? " active" : "") + completeClass + (!canEnter ? " locked" : ""),
          step.name
        );
        item.addEventListener("click", function () {
          if (!canEnter) return;
          state.index = idx;
          state.events = [];
          render();
        });
        nav.appendChild(item);
      });

      var step = state.steps[state.index];
      var title = createEl("h3", null, step.name);
      content.appendChild(title);

      if (!step.command) {
        renderUiStep(step);
      } else {
        if (step.id === "discover_sensors") {
          renderDiscoverStep();
          return;
        }
        if (step.id === "connect_sensors") {
          renderConnectStep();
          return;
        }
        if (step.id === "identify_sensors") {
          renderIdentifyStep();
          return;
        }
        if (step.id === "start_stream") {
          renderStartStreamStep();
          return;
        }
        if (step.id === "stop_stream") {
          renderStopStreamStep();
          return;
        }
        var commandRow = createEl("div", "row");
        var cmdLabel = createEl("span", "label", "Command:");
        var cmdValue = createEl("span", "value", step.command);
        commandRow.appendChild(cmdLabel);
        commandRow.appendChild(cmdValue);
        content.appendChild(commandRow);

        var payloadInput = document.createElement("textarea");
        payloadInput.className = "payload";
        if (step.id === "init_system") {
          payloadInput.value = jsonString(buildInitPayload());
        } else {
          payloadInput.value = getPayloadTemplate(step.command);
        }

        var error = createEl("div", "error");
        var sendBtn = createEl("button", "primary", "Send Command");
        sendBtn.addEventListener("click", function () {
          error.textContent = "";
          var payload = {};
          if (payloadInput.value.trim()) {
            try {
              payload = JSON.parse(payloadInput.value);
            } catch (e) {
              error.textContent = "Invalid JSON payload.";
              return;
            }
          }
          sendCommand(step.command, payload, function () {
            state.completed[step.id] = true;
            render();
          }, function () {
            error.textContent = "Failed to send command.";
          });
        });

        if (payloadInput.value.trim().length > 0) {
          var payloadLabel = createEl("label", "label", "Payload (JSON):");
          content.appendChild(payloadLabel);
          content.appendChild(payloadInput);
        }
        content.appendChild(sendBtn);
        content.appendChild(error);
      }

      var navRow = createEl("div", "nav-row");
      var prev = createEl("button", "secondary", "Prev");
      var next = createEl("button", "secondary", "Next");
      prev.disabled = state.index === 0;
      next.disabled = state.index === state.steps.length - 1 || !state.completed[step.id];
      prev.addEventListener("click", function () {
        if (state.index > 0) {
          state.index -= 1;
          state.events = [];
          render();
        }
      });
      next.addEventListener("click", function () {
        if (state.index < state.steps.length - 1) {
          state.index += 1;
          state.events = [];
          render();
        }
      });
      navRow.appendChild(prev);
      navRow.appendChild(next);
      content.appendChild(navRow);

      var events = createEl("div", "events");
      events.appendChild(createEl("h4", null, "Event Log"));
      var list = createEl("div", "event-list");
      state.events.slice(-12).forEach(function (evt) {
        var line = createEl("pre", "event-line", jsonString(evt));
        list.appendChild(line);
      });
      events.appendChild(list);
      content.appendChild(events);
    }

    function connectEvents() {
      var protocol = window.location.protocol === "https:" ? "wss" : "ws";
      var wsUrl = protocol + "://" + window.location.host + "/api/v1/gateway/events";
      var ws = new WebSocket(wsUrl);
      ws.onmessage = function (msg) {
        try {
          var event = JSON.parse(msg.data);
          if (event.type === "server_ready" && event.payload) {
            if (event.payload.site) {
              state.site = event.payload.site;
              try {
                localStorage.setItem("neia_site", state.site);
              } catch (e) {
                // ignore storage errors
              }
            }
          }
          if (event.type === "server_ready" && event.payload && Array.isArray(event.payload.supported_sensors)) {
            var sensors = event.payload.supported_sensors;
            if (sensors.length && typeof sensors[0] === "object") {
              state.supported_sensors = sensors.map(function (s) { return s.name; }).filter(Boolean);
              sensors.forEach(function (s) {
                if (s.name && Array.isArray(s.locations)) {
                  state.supported_sensor_locations[s.name] = s.locations;
                }
                if (s.name && Array.isArray(s.computations)) {
                  state.supported_sensor_computations[s.name] = s.computations;
                }
              });
            } else {
              state.supported_sensors = sensors;
            }
          }
          if (event.type === "sensors_discovered" || event.type === "sensors_discovered_for_subject") {
            state.completed["discover_sensors"] = true;
          }
          if (event.type === "sensor_connected") {
            state.completed["connect_sensors"] = true;
          }
          if (event.type === "stream_started") {
            state.completed["start_stream"] = true;
          }
          if (event.type === "stream_stopped") {
            state.completed["stop_stream"] = true;
          }
          if (event.type === "sensor_disconnected") {
            state.completed["disconnect"] = true;
          }
          if (event.type === "compute_result" && event.payload && event.payload.subject_id) {
            var sid = event.payload.subject_id;
            state.last_compute[sid] = event;
            if (!state.result_counts[sid]) {
              state.result_counts[sid] = { compute: 0, intermediate: 0 };
            }
            state.result_counts[sid].compute += 1;
          }
          if (event.type === "intermediate_result" && event.payload && event.payload.subject_id) {
            var sid2 = event.payload.subject_id;
            state.last_intermediate[sid2] = event;
            if (!state.result_counts[sid2]) {
              state.result_counts[sid2] = { compute: 0, intermediate: 0 };
            }
            state.result_counts[sid2].intermediate += 1;
          }
          state.events.push(event);
          if (state.site) {
            title.textContent = "NEIA App Template - connected to " + state.site;
          }
          render();
        } catch (e) {
          return;
        }
      };
    }

    function loadSteps() {
      fetch("/api/v1/steps")
        .then(function (resp) {
          if (!resp.ok) throw new Error("fail");
          return resp.json();
        })
        .then(function (data) {
          if (data && Array.isArray(data.steps)) {
            state.steps = data.steps.filter(function (step) {
              return step.id !== "discover_sensors_for_subjects";
            });
            state.completed = {};
          }
          render();
        })
        .catch(function () {
          render();
        });
    }

    function isPrevStepsComplete(targetIndex) {
      for (var i = 0; i < targetIndex; i += 1) {
        var step = state.steps[i];
        if (!state.completed[step.id]) return false;
      }
      return true;
    }

    function renderUiStep(step) {
      if (step.id === "who_session") {
        content.appendChild(createEl("p", "note", "Set who owns the session and the session label."));
        var whoRow = createEl("div", "field");
        var whoLabel = createEl("label", "label", "Who:");
        var whoInput = document.createElement("input");
        whoInput.className = "text-input";
        whoInput.value = state.who || "";
        whoInput.placeholder = "Anna";
        whoInput.addEventListener("input", function (evt) {
          state.who = evt.target.value;
        });
        whoRow.appendChild(whoLabel);
        whoRow.appendChild(whoInput);

        var labelRow = createEl("div", "field");
        var labelLabel = createEl("label", "label", "Label:");
        var labelInput = document.createElement("input");
        labelInput.className = "text-input";
        labelInput.value = state.session_label || "";
        labelInput.placeholder = "baseline_data_collection";
        labelInput.addEventListener("input", function (evt) {
          state.session_label = evt.target.value;
        });
        labelRow.appendChild(labelLabel);
        labelRow.appendChild(labelInput);

        content.appendChild(whoRow);
        content.appendChild(labelRow);
        addCompleteButton(step.id);
        return;
      }

      if (step.id === "subjects") {
        content.appendChild(createEl("p", "note", "Define subject IDs by base name + count."));
        var baseLabel = createEl("label", "label", "Base Name:");
        var baseInput = document.createElement("input");
        baseInput.className = "text-input";
        baseInput.value = state.subject_base;
        baseInput.addEventListener("input", function (evt) {
          state.subject_base = evt.target.value || "subject";
        });
        var countLabel = createEl("label", "label", "Count:");
        var countWrap = createStepper(function (val) {
          state.subject_count = val;
        }, state.subject_count);
        var baseField = createEl("div", "field");
        baseField.appendChild(baseLabel);
        baseField.appendChild(baseInput);
        var countField = createEl("div", "field");
        countField.appendChild(countLabel);
        countField.appendChild(countWrap);
        content.appendChild(baseField);
        content.appendChild(countField);
        addCompleteButton(step.id);
        return;
      }

      if (step.id === "sensors") {
        content.appendChild(createEl("p", "note", "Assign sensor type and quantity per subject."));
        var subjects = buildSubjectIds();
        subjects.forEach(function (subjectId) {
          if (!state.subject_sensors[subjectId]) {
            state.subject_sensors[subjectId] = {
              name: state.sensor_name || "Movella DOT",
              count: state.sensor_count || 1
            };
          }
          var row = createEl("div", "location-row");
          var subLabel = createEl("div", "subject-label", subjectId);
          var select = document.createElement("select");
          select.className = "select-input";
          var options = state.supported_sensors.length ? state.supported_sensors : [state.sensor_name || "Movella DOT"];
          options.forEach(function (opt) {
            var optionEl = document.createElement("option");
            optionEl.value = opt;
            optionEl.textContent = opt;
            select.appendChild(optionEl);
          });
          select.value = state.subject_sensors[subjectId].name;
          select.addEventListener("change", function (evt) {
            state.subject_sensors[subjectId].name = evt.target.value;
          });

          var countWrap = createStepper(function (val) {
            state.subject_sensors[subjectId].count = val;
          }, state.subject_sensors[subjectId].count);

          row.appendChild(subLabel);
          row.appendChild(select);
          row.appendChild(countWrap);
          content.appendChild(row);
        });
        addCompleteButton(step.id);
        return;
      }

      if (step.id === "locations") {
        content.appendChild(createEl("p", "note", "Assign locations to each sensor for each subject."));
        var subjects = buildSubjectIds();
        if (!subjects.length) {
          content.appendChild(createEl("p", "note", "Add subjects first."));
          return;
        }

        if (state.location_subject_index == null) {
          state.location_subject_index = 0;
        }

        var selectorRow = createEl("div", "field");
        var selectorLabel = createEl("label", "label", "Subject:");
        var selector = document.createElement("select");
        selector.className = "select-input";
        subjects.forEach(function (id, idx) {
          var opt = document.createElement("option");
          opt.value = String(idx);
          opt.textContent = id;
          selector.appendChild(opt);
        });
        selector.value = String(state.location_subject_index);
        selector.addEventListener("change", function (evt) {
          state.location_subject_index = parseInt(evt.target.value, 10) || 0;
          render();
        });

        var navRow = createEl("div", "location-nav");
        var prevBtn = createEl("button", "secondary", "Prev Subject");
        var nextBtn = createEl("button", "secondary", "Next Subject");
        prevBtn.disabled = state.location_subject_index <= 0;
        nextBtn.disabled = state.location_subject_index >= subjects.length - 1;
        prevBtn.addEventListener("click", function () {
          state.location_subject_index = Math.max(0, state.location_subject_index - 1);
          render();
        });
        nextBtn.addEventListener("click", function () {
          state.location_subject_index = Math.min(subjects.length - 1, state.location_subject_index + 1);
          render();
        });
        navRow.appendChild(prevBtn);
        navRow.appendChild(nextBtn);

        selectorRow.appendChild(selectorLabel);
        selectorRow.appendChild(selector);
        content.appendChild(selectorRow);
        content.appendChild(navRow);

        var subjectId = subjects[state.location_subject_index];
        if (!state.subject_locations[subjectId]) {
          state.subject_locations[subjectId] = [];
        }
        var sensorConfig = state.subject_sensors[subjectId] || {
          name: state.sensor_name || "Movella DOT",
          count: state.sensor_count || 1
        };
        var options = getLocationOptions(sensorConfig.name);
        var rowsWrap = createEl("div", "field");
        for (var i = 0; i < sensorConfig.count; i += 1) {
          var row = createEl("div", "location-row");
          var label = createEl("div", "subject-label", "Sensor " + (i + 1));
          var select = document.createElement("select");
          select.className = "select-input";
          options.forEach(function (opt) {
            var optionEl = document.createElement("option");
            optionEl.value = opt;
            optionEl.textContent = opt;
            select.appendChild(optionEl);
          });
          select.value = state.subject_locations[subjectId][i] || options[i % options.length] || "";
          (function (index) {
            select.addEventListener("change", function (evt) {
              state.subject_locations[subjectId][index] = evt.target.value;
              render();
            });
          })(i);
          row.appendChild(label);
          row.appendChild(select);
          rowsWrap.appendChild(row);
        }
        content.appendChild(rowsWrap);

        var divider = createEl("div", "divider");
        content.appendChild(divider);

        var summary = createEl("div", "field");
        summary.appendChild(createEl("label", "label", "Assigned Locations:"));
        subjects.forEach(function (id) {
          var assigned = state.subject_locations[id] || [];
          var line = createEl(
            "div",
            "assignment-line",
            id + ": " + (assigned.length ? assigned.join(", ") : "None")
          );
          summary.appendChild(line);
        });
        content.appendChild(summary);
        addCompleteButton(step.id);
        return;
      }

      if (step.id === "algorithms") {
        content.appendChild(createEl("p", "note", "Assign algorithms to sensor types."));
        var subjects = buildSubjectIds();
        if (!subjects.length) {
          content.appendChild(createEl("p", "note", "Add subjects first."));
          return;
        }

        var allSameSensor = subjects.every(function (id) {
          var conf = state.subject_sensors[id];
          return conf && conf.name === state.subject_sensors[subjects[0]].name;
        });

        var modeField = createEl("div", "field");
        var modeLabel = createEl("label", "label", "Assignment Mode:");
        var modeSelect = document.createElement("select");
        modeSelect.className = "select-input half";
        var allOpt = document.createElement("option");
        allOpt.value = "all";
        allOpt.textContent = "One algorithm for all subjects (same sensor type)";
        allOpt.disabled = !allSameSensor;
        var perOpt = document.createElement("option");
        perOpt.value = "per_subject";
        perOpt.textContent = "Per subject";
        modeSelect.appendChild(allOpt);
        modeSelect.appendChild(perOpt);
        if (!allSameSensor) {
          state.algorithm_assign_mode = "per_subject";
        }
        modeSelect.value = state.algorithm_assign_mode;
        modeSelect.addEventListener("change", function (evt) {
          state.algorithm_assign_mode = evt.target.value;
          render();
        });
        modeField.appendChild(modeLabel);
        modeField.appendChild(modeSelect);
        content.appendChild(modeField);

        if (state.algorithm_assign_mode === "all") {
          var allSensorName = state.subject_sensors[subjects[0]].name;
          var algoOptions = getComputationNames(allSensorName);
          if (!algoOptions.length) {
            content.appendChild(
              createEl(
                "p",
                "note",
                "No computations returned for " + allSensorName + ". This sensor cannot be used."
              )
            );
            addCompleteButton(step.id);
            return;
          }
          var row = createEl("div", "sensor-row");
          row.appendChild(createEl("div", "subject-label", allSensorName));
          var algoSelect = document.createElement("select");
          algoSelect.className = "select-input";
          algoOptions.forEach(function (opt) {
            var optionEl = document.createElement("option");
            optionEl.value = opt;
            optionEl.textContent = opt;
            algoSelect.appendChild(optionEl);
          });
          if (algoOptions.indexOf(state.algorithm_all_name) === -1) {
            state.algorithm_all_name = algoOptions[0];
            state.algorithm_all_inputs = jsonString(getComputationInputs(allSensorName, state.algorithm_all_name));
          }
          algoSelect.value = state.algorithm_all_name || algoOptions[0];
          algoSelect.addEventListener("change", function (evt) {
            state.algorithm_all_name = evt.target.value;
            state.algorithm_all_inputs = jsonString(getComputationInputs(allSensorName, state.algorithm_all_name));
            render();
          });
          row.appendChild(algoSelect);
          content.appendChild(row);

          var inputFieldAll = createEl("div", "field");
          var inputLabelAll = createEl("label", "label", "Inputs (JSON):");
          var inputBoxAll = document.createElement("textarea");
          inputBoxAll.className = "payload";
          inputBoxAll.value = state.algorithm_all_inputs;
          inputBoxAll.addEventListener("input", function (evt) {
            state.algorithm_all_inputs = evt.target.value;
          });
          inputFieldAll.appendChild(inputLabelAll);
          inputFieldAll.appendChild(inputBoxAll);
          content.appendChild(inputFieldAll);
        } else {
          if (state.algorithm_subject_index == null) {
            state.algorithm_subject_index = 0;
          }
          var selectorRow = createEl("div", "field");
          var selectorLabel = createEl("label", "label", "Subject:");
          var selector = document.createElement("select");
          selector.className = "select-input third";
          subjects.forEach(function (id, idx) {
            var opt = document.createElement("option");
            opt.value = String(idx);
            opt.textContent = id;
            selector.appendChild(opt);
          });
          selector.value = String(state.algorithm_subject_index);
          selector.addEventListener("change", function (evt) {
            state.algorithm_subject_index = parseInt(evt.target.value, 10) || 0;
            render();
          });
          selectorRow.appendChild(selectorLabel);
          selectorRow.appendChild(selector);
          content.appendChild(selectorRow);

          var navRow = createEl("div", "location-nav");
          var prevBtn = createEl("button", "secondary", "Prev Subject");
          var nextBtn = createEl("button", "secondary", "Next Subject");
          prevBtn.disabled = state.algorithm_subject_index <= 0;
          nextBtn.disabled = state.algorithm_subject_index >= subjects.length - 1;
          prevBtn.addEventListener("click", function () {
            state.algorithm_subject_index = Math.max(0, state.algorithm_subject_index - 1);
            render();
          });
          nextBtn.addEventListener("click", function () {
            state.algorithm_subject_index = Math.min(subjects.length - 1, state.algorithm_subject_index + 1);
            render();
          });
          navRow.appendChild(prevBtn);
          navRow.appendChild(nextBtn);
          content.appendChild(navRow);

          var subjectId = subjects[state.algorithm_subject_index];
          if (!state.subject_algorithms[subjectId]) {
            state.subject_algorithms[subjectId] = {};
          }
          var sensorName = (state.subject_sensors[subjectId] && state.subject_sensors[subjectId].name) || "Movella DOT";
          var rowSubject = createEl("div", "location-row");
          rowSubject.appendChild(createEl("div", "subject-label", sensorName));
          var algoSelectSub = document.createElement("select");
          algoSelectSub.className = "select-input";
          var algoOptionsSub = getComputationNames(sensorName);
          if (!algoOptionsSub.length) {
            content.appendChild(
              createEl(
                "p",
                "note",
                "No computations returned for " + sensorName + ". This sensor cannot be used."
              )
            );
            addCompleteButton(step.id);
            return;
          }
          algoOptionsSub.forEach(function (opt) {
            var optionEl = document.createElement("option");
            optionEl.value = opt;
            optionEl.textContent = opt;
            algoSelectSub.appendChild(optionEl);
          });
          if (!state.subject_algorithms[subjectId][sensorName]) {
            state.subject_algorithms[subjectId][sensorName] = {
              name: algoOptionsSub[0] || "standard_loading_intensity",
              inputs: jsonString(getComputationInputs(sensorName, algoOptionsSub[0]))
            };
          }
          if (algoOptionsSub.indexOf(state.subject_algorithms[subjectId][sensorName].name) === -1) {
            state.subject_algorithms[subjectId][sensorName].name = algoOptionsSub[0];
            state.subject_algorithms[subjectId][sensorName].inputs = jsonString(
              getComputationInputs(sensorName, algoOptionsSub[0])
            );
          }
          algoSelectSub.value = state.subject_algorithms[subjectId][sensorName].name || algoOptionsSub[0];
          algoSelectSub.addEventListener("change", function (evt) {
            state.subject_algorithms[subjectId][sensorName].name = evt.target.value;
            state.subject_algorithms[subjectId][sensorName].inputs = jsonString(
              getComputationInputs(sensorName, state.subject_algorithms[subjectId][sensorName].name)
            );
            render();
          });
          rowSubject.appendChild(algoSelectSub);
          content.appendChild(rowSubject);

          var inputField = createEl("div", "field");
          var inputLabel = createEl("label", "label", "Inputs (JSON):");
          var inputBox = document.createElement("textarea");
          inputBox.className = "payload";
          inputBox.value = state.subject_algorithms[subjectId][sensorName].inputs;
          inputBox.addEventListener("input", function (evt) {
            state.subject_algorithms[subjectId][sensorName].inputs = evt.target.value;
          });
          inputField.appendChild(inputLabel);
          inputField.appendChild(inputBox);
          content.appendChild(inputField);
        }

        var divider = createEl("div", "divider");
        content.appendChild(divider);
        var summary = createEl("div", "field");
        summary.appendChild(createEl("label", "label", "Assigned Algorithms:"));
        subjects.forEach(function (id) {
          var assigned = getAssignedAlgorithmsForSubject(id);
          summary.appendChild(createEl("div", "assignment-line", id + ": " + assigned));
        });
        content.appendChild(summary);

        addCompleteButton(step.id);
        return;
      }

      content.appendChild(createEl("p", "note", "UI-only step. Add your own inputs and logic here."));
      addCompleteButton(step.id);
    }

    function addCompleteButton(stepId) {
      var markBtn = createEl("button", "primary", "Mark Step Complete");
      markBtn.classList.add("mark-complete");
      markBtn.addEventListener("click", function () {
        state.completed[stepId] = true;
        render();
      });
      content.appendChild(markBtn);
    }

    function sendCommand(type, payload, onOk, onError) {
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        if (state.site && payload.site === undefined) {
          payload.site = state.site;
        }
      }
      fetch("/api/v1/gateway/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type, payload: payload || {} })
      })
        .then(function (resp) {
          if (!resp.ok) {
            throw new Error("Command failed");
          }
          if (onOk) onOk();
        })
        .catch(function () {
          if (onError) onError();
        });
    }

    function renderDiscoverStep() {
      content.appendChild(createEl("p", "note", "Discover sensors for all subjects or a selected subject."));
      var modeField = createEl("div", "field");
      var modeLabel = createEl("label", "label", "Mode:");
      var modeSelect = document.createElement("select");
      modeSelect.className = "select-input third";
      var allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "Discover All";
      var subOpt = document.createElement("option");
      subOpt.value = "subject";
      subOpt.textContent = "Discover by Subject";
      modeSelect.appendChild(allOpt);
      modeSelect.appendChild(subOpt);
      modeSelect.value = state.discover_mode || "all";
      modeSelect.addEventListener("change", function (evt) {
        state.discover_mode = evt.target.value;
        render();
      });
      modeField.appendChild(modeLabel);
      modeField.appendChild(modeSelect);
      content.appendChild(modeField);

      var subjects = buildSubjectIds();
      if (state.discover_mode === "subject") {
        if (state.discover_subject_index == null) {
          state.discover_subject_index = 0;
        }
        var selectorRow = createEl("div", "field");
        var selectorLabel = createEl("label", "label", "Subject:");
        var selector = document.createElement("select");
        selector.className = "select-input third";
        subjects.forEach(function (id, idx) {
          var opt = document.createElement("option");
          opt.value = String(idx);
          opt.textContent = id;
          selector.appendChild(opt);
        });
        selector.value = String(state.discover_subject_index);
        selector.addEventListener("change", function (evt) {
          state.discover_subject_index = parseInt(evt.target.value, 10) || 0;
        });
        selectorRow.appendChild(selectorLabel);
        selectorRow.appendChild(selector);
        content.appendChild(selectorRow);

        var navRow = createEl("div", "location-nav");
        var prevBtn = createEl("button", "secondary", "Prev Subject");
        var nextBtn = createEl("button", "secondary", "Next Subject");
        prevBtn.disabled = state.discover_subject_index <= 0;
        nextBtn.disabled = state.discover_subject_index >= subjects.length - 1;
        prevBtn.addEventListener("click", function () {
          state.discover_subject_index = Math.max(0, state.discover_subject_index - 1);
          render();
        });
        nextBtn.addEventListener("click", function () {
          state.discover_subject_index = Math.min(subjects.length - 1, state.discover_subject_index + 1);
          render();
        });
        navRow.appendChild(prevBtn);
        navRow.appendChild(nextBtn);
        content.appendChild(navRow);
      }

      var actionRow = createEl("div", "field");
      var actionBtn = createEl("button", "primary", "Discover Sensors");
      var error = createEl("div", "error");
      actionBtn.addEventListener("click", function () {
        state.events = [];
        if (state.discover_mode === "subject") {
          var subjectId = subjects[state.discover_subject_index] || subjects[0];
          sendCommand("discover_sensors_for_subjects", { subject_ids: [subjectId] }, function () {
            state.completed["discover_sensors"] = true;
            render();
          }, function () {
            error.textContent = "Failed to send command.";
          });
        } else {
          sendCommand("discover_sensors", {}, function () {
            state.completed["discover_sensors"] = true;
            render();
          }, function () {
            error.textContent = "Failed to send command.";
          });
        }
      });
      actionRow.appendChild(actionBtn);
      actionRow.appendChild(error);
      content.appendChild(actionRow);

      var navRow = createEl("div", "nav-row");
      var prev = createEl("button", "secondary", "Prev");
      var next = createEl("button", "secondary", "Next");
      prev.disabled = state.index === 0;
      next.disabled = state.index === state.steps.length - 1 || !state.completed["discover_sensors"];
      prev.addEventListener("click", function () {
        if (state.index > 0) {
          state.index -= 1;
          state.events = [];
          render();
        }
      });
      next.addEventListener("click", function () {
        if (state.index < state.steps.length - 1) {
          state.index += 1;
          state.events = [];
          render();
        }
      });
      navRow.appendChild(prev);
      navRow.appendChild(next);
      content.appendChild(navRow);

      var events = createEl("div", "events");
      events.appendChild(createEl("h4", null, "Event Log"));
      var list = createEl("div", "event-list");
      state.events.slice(-12).forEach(function (evt) {
        var line = createEl("pre", "event-line", jsonString(evt));
        list.appendChild(line);
      });
      events.appendChild(list);
      content.appendChild(events);
    }

    function renderConnectStep() {
      content.appendChild(createEl("p", "note", "Connect sensors for all subjects or a selected subject."));
      var modeField = createEl("div", "field");
      var modeLabel = createEl("label", "label", "Mode:");
      var modeSelect = document.createElement("select");
      modeSelect.className = "select-input third";
      var allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "Connect All";
      var subOpt = document.createElement("option");
      subOpt.value = "subject";
      subOpt.textContent = "Connect by Subject";
      modeSelect.appendChild(allOpt);
      modeSelect.appendChild(subOpt);
      modeSelect.value = state.connect_mode || "all";
      modeSelect.addEventListener("change", function (evt) {
        state.connect_mode = evt.target.value;
        render();
      });
      modeField.appendChild(modeLabel);
      modeField.appendChild(modeSelect);
      content.appendChild(modeField);

      var subjects = buildSubjectIds();
      if (state.connect_mode === "subject") {
        if (state.connect_subject_index == null) {
          state.connect_subject_index = 0;
        }
        var selectorRow = createEl("div", "field");
        var selectorLabel = createEl("label", "label", "Subject:");
        var selector = document.createElement("select");
        selector.className = "select-input third";
        subjects.forEach(function (id, idx) {
          var opt = document.createElement("option");
          opt.value = String(idx);
          opt.textContent = id;
          selector.appendChild(opt);
        });
        selector.value = String(state.connect_subject_index);
        selector.addEventListener("change", function (evt) {
          state.connect_subject_index = parseInt(evt.target.value, 10) || 0;
        });
        selectorRow.appendChild(selectorLabel);
        selectorRow.appendChild(selector);
        content.appendChild(selectorRow);

        var navRow = createEl("div", "location-nav");
        var prevBtn = createEl("button", "secondary", "Prev Subject");
        var nextBtn = createEl("button", "secondary", "Next Subject");
        prevBtn.disabled = state.connect_subject_index <= 0;
        nextBtn.disabled = state.connect_subject_index >= subjects.length - 1;
        prevBtn.addEventListener("click", function () {
          state.connect_subject_index = Math.max(0, state.connect_subject_index - 1);
          render();
        });
        nextBtn.addEventListener("click", function () {
          state.connect_subject_index = Math.min(subjects.length - 1, state.connect_subject_index + 1);
          render();
        });
        navRow.appendChild(prevBtn);
        navRow.appendChild(nextBtn);
        content.appendChild(navRow);
      }

      var actionRow = createEl("div", "field");
      var actionBtn = createEl("button", "primary", "Connect Sensors");
      var error = createEl("div", "error");
      actionBtn.addEventListener("click", function () {
        state.events = [];
        if (state.connect_mode === "subject") {
          var subjectId = subjects[state.connect_subject_index] || subjects[0];
          sendCommand("connect_subjects", { subject_ids: [subjectId] }, function () {
            state.completed["connect_sensors"] = true;
            render();
          }, function () {
            error.textContent = "Failed to send command.";
          });
        } else {
          sendCommand("connect_all", {}, function () {
            state.completed["connect_sensors"] = true;
            render();
          }, function () {
            error.textContent = "Failed to send command.";
          });
        }
      });
      actionRow.appendChild(actionBtn);
      actionRow.appendChild(error);
      content.appendChild(actionRow);

      var navRow2 = createEl("div", "nav-row");
      var prev = createEl("button", "secondary", "Prev");
      var next = createEl("button", "secondary", "Next");
      prev.disabled = state.index === 0;
      next.disabled = state.index === state.steps.length - 1 || !state.completed["connect_sensors"];
      prev.addEventListener("click", function () {
        if (state.index > 0) {
          state.index -= 1;
          state.events = [];
          render();
        }
      });
      next.addEventListener("click", function () {
        if (state.index < state.steps.length - 1) {
          state.index += 1;
          state.events = [];
          render();
        }
      });
      navRow2.appendChild(prev);
      navRow2.appendChild(next);
      content.appendChild(navRow2);

      var events = createEl("div", "events");
      events.appendChild(createEl("h4", null, "Event Log"));
      var list = createEl("div", "event-list");
      state.events.slice(-12).forEach(function (evt) {
        var line = createEl("pre", "event-line", jsonString(evt));
        list.appendChild(line);
      });
      events.appendChild(list);
      content.appendChild(events);
    }

    function renderIdentifyStep() {
      content.appendChild(createEl("p", "note", "Select a subject and sensor location to identify."));
      var subjects = buildSubjectIds();
      if (!subjects.length) {
        content.appendChild(createEl("p", "note", "Add subjects first."));
        return;
      }

      var selectorRow = createEl("div", "field");
      var selectorLabel = createEl("label", "label", "Subject:");
      var selector = document.createElement("select");
      selector.className = "select-input third";
      subjects.forEach(function (id, idx) {
        var opt = document.createElement("option");
        opt.value = String(idx);
        opt.textContent = id;
        selector.appendChild(opt);
      });
      if (state.identify_subject_index == null) {
        state.identify_subject_index = 0;
      }
      selector.value = String(state.identify_subject_index);
      selector.addEventListener("change", function (evt) {
        state.identify_subject_index = parseInt(evt.target.value, 10) || 0;
        render();
      });
      selectorRow.appendChild(selectorLabel);
      selectorRow.appendChild(selector);
      content.appendChild(selectorRow);

      var navRow = createEl("div", "location-nav");
      var prevBtn = createEl("button", "secondary", "Prev Subject");
      var nextBtn = createEl("button", "secondary", "Next Subject");
      prevBtn.disabled = state.identify_subject_index <= 0;
      nextBtn.disabled = state.identify_subject_index >= subjects.length - 1;
      prevBtn.addEventListener("click", function () {
        state.identify_subject_index = Math.max(0, state.identify_subject_index - 1);
        render();
      });
      nextBtn.addEventListener("click", function () {
        state.identify_subject_index = Math.min(subjects.length - 1, state.identify_subject_index + 1);
        render();
      });
      navRow.appendChild(prevBtn);
      navRow.appendChild(nextBtn);
      content.appendChild(navRow);

      var subjectId = subjects[state.identify_subject_index];
      var sensorConfig = state.subject_sensors[subjectId] || {
        name: state.sensor_name || "Movella DOT",
        count: state.sensor_count || 1
      };
      var locations = state.subject_locations[subjectId] || [];
      var options = locations.length ? locations : [];

      if (!options.length) {
        content.appendChild(createEl("p", "note", "No locations assigned for this subject. Set locations first."));
      } else {
        if (options.indexOf(state.identify_location) === -1) {
          state.identify_location = options[0];
        }
        var sensorField = createEl("div", "field");
        var sensorLabel = createEl("label", "label", "Sensor Location:");
        var sensorSelect = document.createElement("select");
        sensorSelect.className = "select-input third";
        options.forEach(function (loc) {
          var opt = document.createElement("option");
          opt.value = loc;
          opt.textContent = loc;
          sensorSelect.appendChild(opt);
        });
        sensorSelect.value = state.identify_location || options[0] || "";
        sensorSelect.addEventListener("change", function (evt) {
          state.identify_location = evt.target.value;
        });
        sensorField.appendChild(sensorLabel);
        sensorField.appendChild(sensorSelect);
        content.appendChild(sensorField);
      }

      var actionRow = createEl("div", "field");
      var actionBtn = createEl("button", "primary", "Identify Sensor");
      var error = createEl("div", "error");
      actionBtn.addEventListener("click", function () {
        if (!options.length) {
          error.textContent = "No locations assigned for this subject.";
          return;
        }
        state.events = [];
        sendCommand("identify_sensor", { subject_id: subjectId, location: state.identify_location || options[0] }, function () {
          state.completed["identify_sensors"] = true;
          render();
        }, function () {
          error.textContent = "Failed to send command.";
        });
      });
      actionRow.appendChild(actionBtn);
      actionRow.appendChild(error);
      content.appendChild(actionRow);

      var navRow2 = createEl("div", "nav-row");
      var prev = createEl("button", "secondary", "Prev");
      var next = createEl("button", "secondary", "Next");
      prev.disabled = state.index === 0;
      next.disabled = state.index === state.steps.length - 1 || !state.completed["identify_sensors"];
      prev.addEventListener("click", function () {
        if (state.index > 0) {
          state.index -= 1;
          state.events = [];
          render();
        }
      });
      next.addEventListener("click", function () {
        if (state.index < state.steps.length - 1) {
          state.index += 1;
          state.events = [];
          render();
        }
      });
      navRow2.appendChild(prev);
      navRow2.appendChild(next);
      content.appendChild(navRow2);

      var events = createEl("div", "events");
      events.appendChild(createEl("h4", null, "Event Log"));
      var list = createEl("div", "event-list");
      state.events.slice(-12).forEach(function (evt) {
        var line = createEl("pre", "event-line", jsonString(evt));
        list.appendChild(line);
      });
      events.appendChild(list);
      content.appendChild(events);
    }

    function renderStartStreamStep() {
      content.appendChild(createEl("p", "note", "Start streaming for all subjects or a selected subject."));
      var modeField = createEl("div", "field");
      var modeLabel = createEl("label", "label", "Mode:");
      var modeSelect = document.createElement("select");
      modeSelect.className = "select-input third";
      var allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "Start All";
      var subOpt = document.createElement("option");
      subOpt.value = "subject";
      subOpt.textContent = "Start by Subject";
      modeSelect.appendChild(allOpt);
      modeSelect.appendChild(subOpt);
      modeSelect.value = state.start_mode || "all";
      modeSelect.addEventListener("change", function (evt) {
        state.start_mode = evt.target.value;
        render();
      });
      modeField.appendChild(modeLabel);
      modeField.appendChild(modeSelect);
      content.appendChild(modeField);

      var subjects = buildSubjectIds();
      if (state.start_mode === "subject") {
        if (state.stream_subject_index == null) {
          state.stream_subject_index = 0;
        }
        var selectorRow = createEl("div", "field");
        var selectorLabel = createEl("label", "label", "Subject:");
        var selector = document.createElement("select");
        selector.className = "select-input third";
        subjects.forEach(function (id, idx) {
          var opt = document.createElement("option");
          opt.value = String(idx);
          opt.textContent = id;
          selector.appendChild(opt);
        });
        selector.value = String(state.stream_subject_index);
        selector.addEventListener("change", function (evt) {
          state.stream_subject_index = parseInt(evt.target.value, 10) || 0;
        });
        selectorRow.appendChild(selectorLabel);
        selectorRow.appendChild(selector);
        content.appendChild(selectorRow);

        var navRow = createEl("div", "location-nav");
        var prevBtn = createEl("button", "secondary", "Prev Subject");
        var nextBtn = createEl("button", "secondary", "Next Subject");
        prevBtn.disabled = state.stream_subject_index <= 0;
        nextBtn.disabled = state.stream_subject_index >= subjects.length - 1;
        prevBtn.addEventListener("click", function () {
          state.stream_subject_index = Math.max(0, state.stream_subject_index - 1);
          render();
        });
        nextBtn.addEventListener("click", function () {
          state.stream_subject_index = Math.min(subjects.length - 1, state.stream_subject_index + 1);
          render();
        });
        navRow.appendChild(prevBtn);
        navRow.appendChild(nextBtn);
        content.appendChild(navRow);
      }

      var tagField = createEl("div", "field");
      var tagLabel = createEl("label", "label", "Tag (optional):");
      var tagInput = document.createElement("input");
      tagInput.className = "text-input";
      tagInput.value = state.stream_tag || "";
      tagInput.addEventListener("input", function (evt) {
        state.stream_tag = evt.target.value;
      });
      tagField.appendChild(tagLabel);
      tagField.appendChild(tagInput);
      content.appendChild(tagField);

      var actionRow = createEl("div", "field");
      var actionBtn = createEl("button", "primary", "Start Stream");
      var error = createEl("div", "error");
      actionBtn.addEventListener("click", function () {
        state.events = [];
        if (state.start_mode === "subject") {
          var subjectId = subjects[state.stream_subject_index] || subjects[0];
          sendCommand("start_stream_for_subjects", { subject_ids: [subjectId], tag: state.stream_tag || undefined }, function () {
            state.completed["start_stream"] = true;
            render();
          }, function () {
            error.textContent = "Failed to send command.";
          });
        } else {
          sendCommand("start_stream_for_all", state.stream_tag ? { tag: state.stream_tag } : {}, function () {
            state.completed["start_stream"] = true;
            render();
          }, function () {
            error.textContent = "Failed to send command.";
          });
        }
      });
      actionRow.appendChild(actionBtn);
      actionRow.appendChild(error);
      content.appendChild(actionRow);

      var navRow2 = createEl("div", "nav-row");
      var prev = createEl("button", "secondary", "Prev");
      var next = createEl("button", "secondary", "Next");
      prev.disabled = state.index === 0;
      next.disabled = state.index === state.steps.length - 1 || !state.completed["start_stream"];
      prev.addEventListener("click", function () {
        if (state.index > 0) {
          state.index -= 1;
          state.events = [];
          render();
        }
      });
      next.addEventListener("click", function () {
        if (state.index < state.steps.length - 1) {
          state.index += 1;
          state.events = [];
          render();
        }
      });
      navRow2.appendChild(prev);
      navRow2.appendChild(next);
      content.appendChild(navRow2);

      var results = createEl("div", "events");
      results.appendChild(createEl("h4", null, "Live Results"));
      var viewRow = createEl("div", "field");
      var viewLabel = createEl("label", "label", "View Subject:");
      var viewSelect = document.createElement("select");
      viewSelect.className = "select-input third";
      subjects.forEach(function (id, idx) {
        var opt = document.createElement("option");
        opt.value = String(idx);
        opt.textContent = id;
        viewSelect.appendChild(opt);
      });
      if (state.result_view_subject_index == null) {
        state.result_view_subject_index = 0;
      }
      viewSelect.value = String(state.result_view_subject_index);
      viewSelect.addEventListener("change", function (evt) {
        state.result_view_subject_index = parseInt(evt.target.value, 10) || 0;
        render();
      });
      viewRow.appendChild(viewLabel);
      viewRow.appendChild(viewSelect);
      results.appendChild(viewRow);

      var subjectId = subjects[state.result_view_subject_index] || subjects[0];
      var counts = state.result_counts[subjectId] || { compute: 0, intermediate: 0 };
      var latestCompute = state.last_compute[subjectId];
      var latestIntermediate = state.last_intermediate[subjectId];

      var sensorCount = (state.subject_sensors[subjectId] && state.subject_sensors[subjectId].count) || 1;
      var computeGrid = createEl("div", "result-grid");
      for (var i = 0; i < sensorCount; i += 1) {
        var computeBox = createEl("div", "result-box");
        computeBox.appendChild(createEl("h4", null, "Sensor " + (i + 1) + " Result"));
        computeBox.appendChild(createEl("pre", "event-line", latestCompute ? jsonString(latestCompute) : "No results yet."));
        computeGrid.appendChild(computeBox);
      }
      results.appendChild(createEl("h4", null, "Latest Compute Results (" + counts.compute + ")"));
      results.appendChild(computeGrid);

      var intermediateBox = createEl("div", "result-box");
      intermediateBox.appendChild(createEl("h4", null, "Latest Intermediate Result (" + counts.intermediate + ")"));
      intermediateBox.appendChild(createEl("pre", "event-line", latestIntermediate ? jsonString(latestIntermediate) : "No results yet."));
      results.appendChild(intermediateBox);

      content.appendChild(results);
    }

    function renderStopStreamStep() {
      content.appendChild(createEl("p", "note", "Stop streaming for all subjects or a selected subject."));
      var modeField = createEl("div", "field");
      var modeLabel = createEl("label", "label", "Mode:");
      var modeSelect = document.createElement("select");
      modeSelect.className = "select-input third";
      var allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "Stop All";
      var subOpt = document.createElement("option");
      subOpt.value = "subject";
      subOpt.textContent = "Stop by Subject";
      modeSelect.appendChild(allOpt);
      modeSelect.appendChild(subOpt);
      modeSelect.value = state.stop_mode || "all";
      modeSelect.addEventListener("change", function (evt) {
        state.stop_mode = evt.target.value;
        render();
      });
      modeField.appendChild(modeLabel);
      modeField.appendChild(modeSelect);
      content.appendChild(modeField);

      var subjects = buildSubjectIds();
      if (state.stop_mode === "subject") {
        if (state.stop_subject_index == null) {
          state.stop_subject_index = 0;
        }
        var selectorRow = createEl("div", "field");
        var selectorLabel = createEl("label", "label", "Subject:");
        var selector = document.createElement("select");
        selector.className = "select-input third";
        subjects.forEach(function (id, idx) {
          var opt = document.createElement("option");
          opt.value = String(idx);
          opt.textContent = id;
          selector.appendChild(opt);
        });
        selector.value = String(state.stop_subject_index);
        selector.addEventListener("change", function (evt) {
          state.stop_subject_index = parseInt(evt.target.value, 10) || 0;
        });
        selectorRow.appendChild(selectorLabel);
        selectorRow.appendChild(selector);
        content.appendChild(selectorRow);

        var navRow = createEl("div", "location-nav");
        var prevBtn = createEl("button", "secondary", "Prev Subject");
        var nextBtn = createEl("button", "secondary", "Next Subject");
        prevBtn.disabled = state.stop_subject_index <= 0;
        nextBtn.disabled = state.stop_subject_index >= subjects.length - 1;
        prevBtn.addEventListener("click", function () {
          state.stop_subject_index = Math.max(0, state.stop_subject_index - 1);
          render();
        });
        nextBtn.addEventListener("click", function () {
          state.stop_subject_index = Math.min(subjects.length - 1, state.stop_subject_index + 1);
          render();
        });
        navRow.appendChild(prevBtn);
        navRow.appendChild(nextBtn);
        content.appendChild(navRow);
      }

      var actionRow = createEl("div", "field");
      var actionBtn = createEl("button", "primary", "Stop Stream");
      var error = createEl("div", "error");
      actionBtn.addEventListener("click", function () {
        state.events = [];
        if (state.stop_mode === "subject") {
          var subjectId = subjects[state.stop_subject_index] || subjects[0];
          sendCommand("stop_stream_for_subjects", { subject_ids: [subjectId] }, function () {
            state.completed["stop_stream"] = true;
            render();
          }, function () {
            error.textContent = "Failed to send command.";
          });
        } else {
          sendCommand("stop_stream_for_all", {}, function () {
            state.completed["stop_stream"] = true;
            render();
          }, function () {
            error.textContent = "Failed to send command.";
          });
        }
      });
      actionRow.appendChild(actionBtn);
      actionRow.appendChild(error);
      content.appendChild(actionRow);

      var navRow2 = createEl("div", "nav-row");
      var prev = createEl("button", "secondary", "Prev");
      var next = createEl("button", "secondary", "Next");
      prev.disabled = state.index === 0;
      next.disabled = state.index === state.steps.length - 1 || !state.completed["stop_stream"];
      prev.addEventListener("click", function () {
        if (state.index > 0) {
          state.index -= 1;
          state.events = [];
          render();
        }
      });
      next.addEventListener("click", function () {
        if (state.index < state.steps.length - 1) {
          state.index += 1;
          state.events = [];
          render();
        }
      });
      navRow2.appendChild(prev);
      navRow2.appendChild(next);
      content.appendChild(navRow2);

      var events = createEl("div", "events");
      events.appendChild(createEl("h4", null, "Event Log"));
      var list = createEl("div", "event-list");
      state.events.slice(-12).forEach(function (evt) {
        var line = createEl("pre", "event-line", jsonString(evt));
        list.appendChild(line);
      });
      events.appendChild(list);
      content.appendChild(events);
    }

    function createStepper(onChange, initialValue) {
      var countWrap = createEl("div", "stepper");
      var decBtn = createEl("button", "secondary", "-");
      var incBtn = createEl("button", "secondary", "+");
      var countInput = document.createElement("input");
      countInput.type = "number";
      countInput.min = "1";
      countInput.step = "1";
      countInput.readOnly = true;
      countInput.className = "text-input";
      var current = Number.isFinite(initialValue) && initialValue > 0 ? initialValue : 1;
      countInput.value = String(current);
      decBtn.addEventListener("click", function () {
        current = Math.max(1, current - 1);
        countInput.value = String(current);
        onChange(current);
      });
      incBtn.addEventListener("click", function () {
        current = current + 1;
        countInput.value = String(current);
        onChange(current);
      });
      countWrap.appendChild(decBtn);
      countWrap.appendChild(countInput);
      countWrap.appendChild(incBtn);
      return countWrap;
    }

    function buildSubjectIds() {
      var count = state.subject_count || 1;
      var base = state.subject_base || "subject";
      var ids = [];
      for (var i = 0; i < count; i += 1) {
        ids.push(base + "_" + i);
      }
      return ids;
    }

    function getLocationOptions(sensorName) {
      var options = state.supported_sensor_locations[sensorName];
      if (Array.isArray(options) && options.length) {
        return options;
      }
      return state.locations && state.locations.length ? state.locations : ["LEFT_ANKLE", "RIGHT_ANKLE"];
    }

    function getComputationOptions(sensorName) {
      var options = state.supported_sensor_computations[sensorName];
      if (Array.isArray(options) && options.length) {
        return options;
      }
      return [];
    }

    function getComputationNames(sensorName) {
      return getComputationOptions(sensorName).map(function (entry) {
        return entry && entry.name ? entry.name : null;
      }).filter(Boolean);
    }

    function getComputationInputs(sensorName, algoName) {
      var options = getComputationOptions(sensorName);
      for (var i = 0; i < options.length; i += 1) {
        var entry = options[i];
        if (entry && entry.name === algoName) {
          return entry.inputs || {};
        }
      }
      return {};
    }

    function buildInitPayload() {
      var subjects = [];
      var subjectIds = buildSubjectIds();
      for (var i = 0; i < subjectIds.length; i += 1) {
        var subjectId = subjectIds[i];
        var sensorConfig = state.subject_sensors[subjectId] || {
          name: state.sensor_name || "Movella DOT",
          count: state.sensor_count || 1
        };
        var locs = state.subject_locations[subjectId];
        var effectiveLocations = Array.isArray(locs) && locs.length ? locs : (state.locations && state.locations.length ? state.locations : ["LEFT_ANKLE", "RIGHT_ANKLE"]);
        var algoConfig = getAlgorithmForSubject(subjectId, sensorConfig.name);
        subjects.push({
          subject_id: subjectId,
          sensors: [
            {
              local_name: sensorConfig.name,
              number_of: sensorConfig.count,
              compute_algorithm: {
                name: algoConfig.name,
                inputs: algoConfig.inputs
              },
              locations: effectiveLocations
            }
          ]
        });
      }
      var initLabel = "";
      if (state.who || state.session_label) {
        var whoPart = state.who ? state.who.trim() : "";
        var labelPart = state.session_label ? state.session_label.trim() : "";
        initLabel = [whoPart, labelPart].filter(Boolean).join("_");
      }
      return {
        init_label: initLabel || undefined,
        subjects: subjects
      };
    }

    function getAlgorithmForSubject(subjectId, sensorType) {
      var algoName = "standard_loading_intensity";
      if (state.algorithm_assign_mode === "all") {
        algoName = state.algorithm_all_name || algoName;
        return { name: algoName, inputs: safeJson(state.algorithm_all_inputs) };
      } else {
        var subjectMap = state.subject_algorithms[subjectId] || {};
        var entry = subjectMap[sensorType];
        algoName = entry && entry.name ? entry.name : algoName;
        return { name: algoName, inputs: safeJson(entry ? entry.inputs : "{}") };
      }
    }

    function getAssignedAlgorithmsForSubject(subjectId) {
      if (state.algorithm_assign_mode === "all") {
        return state.algorithm_all_name || "standard_loading_intensity";
      }
      var subjectMap = state.subject_algorithms[subjectId] || {};
      var keys = Object.keys(subjectMap);
      if (!keys.length) {
        return "None";
      }
      return keys.map(function (k) { return k + ":" + subjectMap[k].name; }).join(", ");
    }

    function safeJson(value) {
      try {
        return JSON.parse(value || "{}");
      } catch (e) {
        return {};
      }
    }

    loadSteps();
    connectEvents();
  }

  window.NeiaTemplateMount = mount;
})();
    try {
      var savedSite = localStorage.getItem("neia_site");
      if (savedSite) {
        state.site = savedSite;
        title.textContent = "NEIA App Template - connected to " + state.site;
      }
    } catch (e) {
      // ignore storage errors
    }
