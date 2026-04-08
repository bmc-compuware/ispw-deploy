/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 689:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/* eslint-disable no-unused-vars */
const core = __nccwpck_require__(693);
const utils = __nccwpck_require__(444);

let setID;
let setUrl;

try {
  let deployParms;
  let inputs = [
    "assignment_id",
    "level",
    "task_id",
    "ces_url",
    "ces_token",
    "certificate",
    "srid",
    "runtime_configuration",
    "change_type",
    "execution_status",
    "deploy_automatically",
    "deploy_environments",
    "system",
  ];

  inputs = utils.retrieveInputs(core, inputs);
  core.debug(
    "Code Pipeline: parsed inputs: " + utils.convertObjectToJson(inputs)
  );

  if (utils.stringHasContent(inputs.deploy_automatically)) {
    console.log(
      "Deploy parameters are being retrieved from the " +
        "deploy_automatically input."
    );
    deployParms = utils.parseStringAsJson(inputs.deploy_automatically);
  } else {
    console.log("Deploy parameters are being retrieved from the inputs.");
    deployParms = getParmsFromInputs(
      inputs.assignment_id,
      inputs.level,
      inputs.task_id
    );
  }
  core.debug(
    "Code Pipeline: parsed deploy parms: " +
      utils.convertObjectToJson(deployParms)
  );

  const requiredFields = ["assignment_id", "level"];
  if (!utils.validateBuildParms(deployParms, requiredFields)) {
    throw new MissingArgumentException(
      "Inputs required for Code Pipeline Deploy are missing. " +
        "\nSkipping the deploy request...."
    );
  }

  const reqPath = getDeployTaskUrlPath(inputs.srid, deployParms);
  const reqUrl = utils.assembleRequestUrl(inputs.ces_url, reqPath);
  core.debug("Code Pipeline: request url: " + reqUrl.href);

  const reqBodyObj = assembleRequestBodyObject(
    inputs.runtime_configuration,
    inputs.change_type,
    inputs.execution_status,
    inputs.deployEnvironment,
    inputs.system
  );

  // getting host port details from srid passed
  const hostAndPort = inputs.srid.split("-");
  const host = hostAndPort[0];
  const port = hostAndPort[1];

  if (isAuthTokenOrCerti(inputs.ces_token, inputs.certificate)) {
    //for token
    utils
      .getHttpPostPromise(reqUrl, inputs.ces_token, reqBodyObj)
      .then(
        (response) => {
          core.debug(
            "Code Pipeline: received response body: " +
              utils.convertObjectToJson(response.data)
          );
          // deploy could have passed or failed
          setOutputs(core, response.data);
          return handleResponseBody(response.data);
        },
        (error) => {
          // there was a problem with the request to CES
          if (error.response !== undefined) {
            console.debug(
              "Code Pipeline: received error code: " + error.response.status
            );
            console.debug(
              "Code Pipeline: received error response body: " +
                utils.convertObjectToJson(error.response.data)
            );
            setOutputs(core, error.response.data);
            throw new DeployFailureException(error.response.data.message);
          }
          throw error;
        }
      )
      .then(
        () => {
          console.log("The deploy request has been submitted.");
          let skipWaitingForSetCompletion = false;
          if (!skipWaitingForSetCompletion) {
            if (setID) {
              utils.pollSetStatus(setUrl, setID, inputs.ces_token, "Deploy");
            }
          }
          if (skipWaitingForSetCompletion) {
            console.log(
              "Skip waiting for the completion of the set for this job..."
            );
          }
        },
        (error) => {
          console.log("An error occurred while submitting the deploy request.");
          if (error.stack) {
            core.debug(error.stack);
          } else if (error.message) {
            core.debug(error.message);
          } else {
            core.debug(error);
          }
          core.setFailed(error.message);
        }
      );
  } else {
    //for certificate
    utils
      .getHttpPostPromiseWithCert(
        reqUrl,
        inputs.certificate,
        host,
        port,
        reqBodyObj
      )
      .then(
        (response) => {
          core.debug(
            "Code Pipeline: received response body: " +
              utils.convertObjectToJson(response.data)
          );
          // deploy could have passed or failed
          setOutputs(core, response.data);
          return handleResponseBody(response.data);
        },
        (error) => {
          // there was a problem with the request to CES
          if (error.response !== undefined) {
            console.debug(
              "Code Pipeline: received error code: " + error.response.status
            );
            console.debug(
              "Code Pipeline: received error response body: " +
                utils.convertObjectToJson(error.response.data)
            );
            setOutputs(core, error.response.data);
            throw new DeployFailureException(error.response.data.message);
          }
          throw error;
        }
      )
      .then(
        () => {
          console.log("The deploy request has been submitted.");
          let skipWaitingForSetCompletion = false;
          if (!skipWaitingForSetCompletion) {
            if (setID) {
              utils.pollSetStatus(setUrl, setID, inputs.ces_token, "Deploy");
            }
          }
          if (skipWaitingForSetCompletion) {
            console.log(
              "Skip waiting for the completion of the set for this job..."
            );
          }
        },
        (error) => {
          console.log("An error occurred while submitting the deploy request.");
          if (error.stack) {
            core.debug(error.stack);
          } else if (error.message) {
            core.debug(error.message);
          } else {
            core.debug(error);
          }
          core.setFailed(error.message);
        }
      );
  }
  // the following code will execute after the HTTP request was started,
  // but before it receives a response.
  console.log(
    "Starting to submit the deploy request for task " +
      deployParms.taskIds.toString()
  );
} catch (error) {
  if (error instanceof MissingArgumentException) {
    // this would occur if there was nothing to load during the sync process
    // no need to fail the action if the deploy is never attempted
    console.log(error.message);
  } else {
    console.error("An error occurred while submitting the deploy request.");
    core.setFailed(error.message);
  }
}

/**
 * Examines the given response body to determine whether an error occurred
 * during the deploy.
 * @param {*} responseBody The body returned from the CES request
 * @return {*} The response body object if the deploy was successful,
 * else throws an error
 * @throws deployFailureException if there were failures during the deploy
 */
function handleResponseBody(responseBody) {
  if (responseBody === undefined) {
    // empty response
    throw new DeployFailureException(
      "No response was received from the deploy request."
    );
  } else {
    // success
    console.log(utils.getStatusMessageToPrint(responseBody.message));
    return responseBody;
  }
}

/**
 * Takes the fields from the response body and sends them to the outputs of
 * the job
 * @param {core} core github actions core
 * @param {*} responseBody the response body received from the REST API request
 */
function setOutputs(core, responseBody) {
  if (responseBody) {
    if (responseBody.setId) {
      console.log("Code Pipeline: Set Id - ", responseBody.setId);
      core.setOutput("set_id", responseBody.setId);
      setID = responseBody.setId;
    }

    if (responseBody.url) {
      console.log("Code Pipeline: Set Info Url - ", responseBody.url);
      core.setOutput("url", responseBody.url);
      setUrl = responseBody.url;
    }
  }
}

/**
 * Uses the input parameters from the action metadata to fill in a deployParms
 * object.
 * @param  {string} inputAssignment the assignmentId passed into the action
 * @param  {string} inputLevel the Code Pipeline level passed into the action
 * @param  {string} inputTaskId the comma separated list of task IDs passed
 * into the action
 * @return {deployParms} a deployParms object with the fields filled in.
 * This will never return undefined.
 */
function getParmsFromInputs(inputAssignment, inputLevel, inputTaskId) {
  const deployParms = {};
  if (utils.stringHasContent(inputAssignment)) {
    deployParms.assignment_id = inputAssignment;
  }

  if (utils.stringHasContent(inputLevel)) {
    deployParms.level = inputLevel;
  }

  if (utils.stringHasContent(inputTaskId)) {
    deployParms.taskIds = inputTaskId.split(",");
  }
  return deployParms;
}

/**
 * Error to throw when not all the arguments have been specified for the action.
 * @param  {string} message the message associated with the error
 */
function MissingArgumentException(message) {
  this.message = message;
  this.name = "MissingArgumentException";
}
MissingArgumentException.prototype = Object.create(Error.prototype);

/**
 * Error to throw when the response for the deploy request is incomplete
 *  or indicates errors.
 * @param  {string} message the message associated with the error
 */
function DeployFailureException(message) {
  this.message = message;
  this.name = "DeployFailureException";
}
DeployFailureException.prototype = Object.create(Error.prototype);

/**
 * Gets the request path for the CES REST api deploytask on tasks. The returned path starts with
 * '/ispw/' and ends with the query parameters
 * @param {string} srid The SRID for this instance of Code Pipeline
 * @param {*} deployParms The build parms to use when filling out the request url
 * @return {string} the request path which can be appended to the CES url
 */
function getDeployTaskUrlPath(srid, deployParms) {
  let tempUrlStr = `/ispw/${srid}/assignments/${deployParms.assignment_id}`;
  tempUrlStr = tempUrlStr.concat("/taskIds/deploy?");
  if (Array.isArray(deployParms.taskIds)) {
    deployParms.taskIds.forEach((id) => {
      tempUrlStr = tempUrlStr.concat(`taskId=${id}&`);
    });
  } else {
    tempUrlStr = tempUrlStr.concat(`taskId=${deployParms.taskIds}&`);
  }

  tempUrlStr = tempUrlStr.concat(`level=${deployParms.level}`);
  return tempUrlStr;
}

/**
 * Assembles an object for the CES request body.
 * @param  {string | undefined} runtimeConfig the runtime configuration passed
 * in the inputs
 * @param  {string | undefined} changeType the change type passed in the inputs
 * @param  {string | undefined} executionStatus the execution status passed
 * in the inputs
 * @param  {string | undefined} deployEnvironment whether to auto deploy
 * @param  {string | undefined} system whether to auto deploy
 * @return {any} an object with all the fields for the request body filled in
 */
function assembleRequestBodyObject(
  runtimeConfig,
  changeType,
  executionStatus,
  deployEnvironment,
  system
) {
  const requestBody = {};
  if (utils.stringHasContent(runtimeConfig)) {
    requestBody.runtimeConfiguration = runtimeConfig;
  }
  if (utils.stringHasContent(changeType)) {
    requestBody.changeType = changeType;
  }
  if (utils.stringHasContent(executionStatus)) {
    requestBody.executionStatus = executionStatus;
  }

  if (utils.stringHasContent(deployEnvironment)) {
    requestBody.dpenvlst = deployEnvironment;
  }

  if (utils.stringHasContent(system)) {
    requestBody.system = system;
  }
  return requestBody;
}

/**
 * Checks which authentication method is used in workflow i.e. token or certi
 * @param  {string} cesToken the ces_token for authentication
 * @param  {string} certificate the certificate passed for authentication
 * @return {boolean} which authentication is passed in workflow i.e token or certi
 * true for token
 * false for certi
 */
function isAuthTokenOrCerti(cesToken, certificate) {
  if (utils.stringHasContent(cesToken)) {
    return true;
  } else if (utils.stringHasContent(certificate)) {
    return false;
  } else {
    return undefined;
  }
}

module.exports = {
  getParmsFromInputs,
  setOutputs,
  getDeployTaskUrlPath,
  assembleRequestBodyObject,
  handleResponseBody,
  isAuthTokenOrCerti,
  MissingArgumentException,
  DeployFailureException,
};


/***/ }),

/***/ 693:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 444:
/***/ ((module) => {

module.exports = eval("require")("@bmc-compuware/ispw-action-utilities");


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(689);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;