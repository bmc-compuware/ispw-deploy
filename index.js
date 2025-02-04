/* eslint-disable no-unused-vars */
const core = require("@actions/core");
const utils = require("@bmc-compuware/ispw-action-utilities");
const axios = require('axios');

let setID;
let setUrl;

const SET_STATE_DISPATCHED = "Dispatched";
const SET_STATE_EXECUTING = "Executing";
const SET_STATE_COMPLETE = "Complete";
const SET_STATE_CLOSED = "Closed";
const SET_STATE_FAILED = "Failed";
const SET_STATE_HELD = "Held";
const SET_STATE_RELEASED = "Released";
const SET_STATE_TERMINATED = "Terminated";
const SET_STATE_WAITING_APPROVAL = "Waiting-Approval";
const SET_STATE_WAITING_LOCK = "Waiting-Lock";

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
    "system"
  ];
  
  inputs = utils.retrieveInputs(core, inputs);
  core.debug("Code Pipeline: parsed inputs: " + utils.convertObjectToJson(inputs));

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
    "Code Pipeline: parsed deploy parms: " + utils.convertObjectToJson(deployParms)
  );

  const requiredFields = ["containerId", "taskLevel", "taskIds"];
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
  const hostAndPort = inputs.srid.split('-');
  const host = hostAndPort[0];
  const port = hostAndPort[1];
 
  if(isAuthTokenOrCerti(inputs.ces_token, inputs.certificate)) {
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
          console.debug("Code Pipeline: received error code: " + error.response.status);
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
        console.log("The set_id is :", setID);
        console.log("The set_url is :", setUrl);       
        let skipWaitingForSetCompletion = false;
          if (!skipWaitingForSetCompletion) {
            if (setID) {
              pollSetStatus(setUrl, setID, inputs.ces_token);
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
  }else {
    //for certi
    utils
    .getHttpPostPromiseWithCert(reqUrl, inputs.certificate, host, port, reqBodyObj)
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
          console.debug("Code Pipeline: received error code: " + error.response.status);
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
      () => console.log("The deploy request has been submitted."),
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
    "Starting to submit the deploy request for task " + deployParms.taskIds.toString()
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
      console.log( "Code Pipeline: received set ID: " + responseBody.setId)
      core.setOutput("set_id", responseBody.setId);
      setID=responseBody.setId;
    }

    if (responseBody.url) {
      console.log( "Code Pipeline: received URL: " + responseBody.url)
      core.setOutput("url", responseBody.url);
      setUrl=responseBody.url;
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
    deployParms.containerId = inputAssignment;
  }

  if (utils.stringHasContent(inputLevel)) {
    deployParms.taskLevel = inputLevel;
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
  let tempUrlStr = `/ispw/${srid}/assignments/${deployParms.containerId}`;
  tempUrlStr = tempUrlStr.concat("/taskIds/deploy?");
  if (Array.isArray(deployParms.taskIds)) {
    deployParms.taskIds.forEach((id) => {
      tempUrlStr = tempUrlStr.concat(`taskId=${id}&`);
    });
  } else {
    tempUrlStr = tempUrlStr.concat(`taskId=${deployParms.taskIds}&`);
  }

  tempUrlStr = tempUrlStr.concat(`level=${deployParms.taskLevel}`);
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

// Function to poll the set status
// eslint-disable-next-line require-jsdoc, no-unused-vars
function pollSetStatus(url, setId, token, interval = 2000, timeout = 60000) {
  const startTime = Date.now(); // Track the start time

  try {
    console.log(`Polling the set status for setId: ${setId}`);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const elapsedTime = Date.now() - startTime;

      // Check if the timeout has been reached
      if (elapsedTime >= timeout) {
        console.log(`Polling timed out after ${timeout / 1000} seconds.`);
        break;
      }

      // Poll the URL for set status
      const response = axios.get(`${url}`, {
        headers: {
         "Content-Type": "application/json",
          Authorization: `${token}`,  // Add the token to the headers
        },
      });

      console.log('Response data:', response.data);
      console.log('State:', response.data.state);

      const setStatus = response.data.state;

      console.log(`Current status: ${setStatus}`);

      // if (setStatus == 'Closed') {
      //   console.log(`Set ${setId} is completed!`);
      //   break;
      // }

      console.log("Waiting for set to complete...");
      if (setStatus == SET_STATE_FAILED) {
        console.log(
          "Code Pipeline: Set " + setId + " - action [%s] failed.",
          "Deploy"
        );
        break;
      } else if (setStatus == SET_STATE_TERMINATED) {
        console.log(
          "Code Pipeline: Set " + setId + " - successfully terminated."
        );
        break;
      } else if (setStatus == SET_STATE_HELD) {
        console.log(
          "Code Pipeline: Set " + setId + " - successfully held."
        );
        break;
      } else if (
        setStatus == SET_STATE_RELEASED ||
        setStatus == SET_STATE_WAITING_LOCK
      ) {
        console.log(
          "Code Pipeline: Set " + setId + " - successfully released."
        );
        break;
      } else if (setStatus == SET_STATE_WAITING_APPROVAL) {
        console.log(
          "Code Pipeline: In set (" +
          setId +
            ") process, Approval required."
        );
        break;
      } else if (
        setStatus == SET_STATE_CLOSED ||
        setStatus == SET_STATE_COMPLETE
      ) {
        console.log(
          "Code Pipeline: Action completed."
        );
        break;
      }

      console.log(`Waiting for ${interval / 1000} seconds before the next poll...`);
      // Wait for the specified interval before the next poll
      delay(interval);
    }
  } catch (error) {
    console.error('Error while polling:', error.message || error);
  }
}

// Helper function to delay execution, returning a promise
// eslint-disable-next-line require-jsdoc
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
