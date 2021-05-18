var index = require('../index.js');
const chai = require('chai');
var assert = chai.assert;


describe('#getParmsFromInputs(inputAssignment, inputLevel, inputTaskId)', function () {
  it('should return empty - null passed in', function () {

    let output = index.getParmsFromInputs(null, null, null);
    assert.isNotNull(output);
    assert.strictEqual(output.containerId, undefined);
    assert.strictEqual(output.taskLevel, undefined);
    assert.strictEqual(output.releaseId, undefined);
    assert.strictEqual(output.taskIds, undefined);
  });

  it('should return empty - undefined passed in', function () {
    let output = index.getParmsFromInputs(undefined, undefined, undefined);
    assert.isNotNull(output);
    assert.strictEqual(output.containerId, undefined);
    assert.strictEqual(output.taskLevel, undefined);
    assert.strictEqual(output.releaseId, undefined);
    assert.strictEqual(output.taskIds, undefined);
  });

  it('should return empty - empty passed in', function () {
    let output = index.getParmsFromInputs('', '', '');
    assert.isNotNull(output);
    assert.strictEqual(output.containerId, undefined);
    assert.strictEqual(output.taskLevel, undefined);
    assert.strictEqual(output.releaseId, undefined);
    assert.strictEqual(output.taskIds, undefined);
  });

  it('should have assignment defined', function () {
    let output = index.getParmsFromInputs('assignment123', '', '');
    assert.isNotNull(output);
    assert.strictEqual(output.containerId, 'assignment123');
    assert.strictEqual(output.taskLevel, undefined);
    assert.strictEqual(output.releaseId, undefined);
    assert.strictEqual(output.taskIds, undefined);
  });

  it('should have level defined', function () {
    let output = index.getParmsFromInputs('', 'level', '');
    assert.isNotNull(output);
    assert.strictEqual(output.containerId, undefined);
    assert.strictEqual(output.taskLevel, 'level');
    assert.strictEqual(output.releaseId, undefined);
    assert.strictEqual(output.taskIds, undefined);
  });

  it('should have taskIds defined', function () {
    let output = index.getParmsFromInputs('', '', 'task1,task2,task3,task4');
    assert.isNotNull(output);
    assert.strictEqual(output.containerId, undefined);
    assert.strictEqual(output.taskLevel, undefined);
    assert.strictEqual(output.releaseId, undefined);
    assert.deepStrictEqual(output.taskIds, ['task1', 'task2', 'task3', 'task4']);
  });

});

describe('#setOutputs(core, responseBody)', function () {
  it('should call setOutput for each field in the response body', function () {
    let core = {
      outputs: {},
      setOutput: function (outputName, outputValue) {
        this.outputs[outputName] = outputValue;
      }
    };

    let responseBody = {};
    index.setOutputs(core, responseBody);
    assert.strictEqual(core.outputs.set_id, undefined);
    assert.strictEqual(core.outputs.url, undefined);
 

    responseBody = {
      setId: 'set1234',
      url: 'url/to/set1234'
    };
    index.setOutputs(core, responseBody);
    assert.strictEqual(core.outputs.set_id, 'set1234');
    assert.strictEqual(core.outputs.url, 'url/to/set1234');

  });

}); 

describe('#getDeployTaskUrlPath(srid, buildParms)', function () {
  it('should handle single taskId', function () {
    let output = index.getDeployTaskUrlPath('SRID', {
      containerId: 'container1',
      taskLevel: 'DEV3',
      taskIds: ['abc123']
    });
    assert.strictEqual(output, '/ispw/SRID/assignments/container1/taskIds/deploy?taskId=abc123&level=DEV3');
  });

  it('should handle multiple taskIds', function () {
    let output = index.getDeployTaskUrlPath('SRID', {
      containerId: 'container1',
      taskLevel: 'DEV3',
      taskIds: ['abc123', 'def456']
    });
    assert.strictEqual(output, '/ispw/SRID/assignments/container1/taskIds/deploy?taskId=abc123&taskId=def456&level=DEV3');

  });
});

describe('#assembleRequestBodyObject(runtimeConfiguration, changeType, executionStatus, autoDeploy)', function () {
  it('should be missing runtime config', function () {
    let output = index.assembleRequestBodyObject(null, 'E', 'H', 'deployenvs', 'system');
    assert.strictEqual(output.runtimeConfiguration, undefined);
    assert.strictEqual(output.changeType, 'E');
    assert.strictEqual(output.executionStatus, 'H');
 

    output = index.assembleRequestBodyObject(undefined, 'E', 'H', 'deployenvs', 'system');
    assert.strictEqual(output.runtimeConfiguration, undefined);
    assert.strictEqual(output.changeType, 'E');
    assert.strictEqual(output.executionStatus, 'H');
 

    output = index.assembleRequestBodyObject('', 'E', 'H', 'deployenvs', 'system');
    assert.strictEqual(output.runtimeConfiguration, undefined);
    assert.strictEqual(output.changeType, 'E');
    assert.strictEqual(output.executionStatus, 'H');
 
  });

  it('should be missing changeType', function () {
    let output = index.assembleRequestBodyObject('TPZP', null, 'H', 'deployenvs', 'system');
    assert.strictEqual(output.runtimeConfiguration, 'TPZP');
    assert.strictEqual(output.changeType, undefined);
    assert.strictEqual(output.executionStatus, 'H');
 

    output = index.assembleRequestBodyObject('TPZP', undefined, 'H', 'deployenvs', 'system');
    assert.strictEqual(output.runtimeConfiguration, 'TPZP');
    assert.strictEqual(output.changeType, undefined);
    assert.strictEqual(output.executionStatus, 'H');
 

    output = index.assembleRequestBodyObject('TPZP', '', 'H', 'deployenvs', 'system');
    assert.strictEqual(output.runtimeConfiguration, 'TPZP');
    assert.strictEqual(output.changeType, undefined);
    assert.strictEqual(output.executionStatus, 'H');
 
  });

  it('should be missing executionStatus', function () {
    let output = index.assembleRequestBodyObject('TPZP', 'E', null, 'true', 'system');
    assert.strictEqual(output.runtimeConfiguration, 'TPZP');
    assert.strictEqual(output.changeType, 'E');
    assert.strictEqual(output.executionStatus, undefined);
 

    output = index.assembleRequestBodyObject('TPZP', 'E', undefined, 'true', 'system');
    assert.strictEqual(output.runtimeConfiguration, 'TPZP');
    assert.strictEqual(output.changeType, 'E');
    assert.strictEqual(output.executionStatus, undefined);
  

    output = index.assembleRequestBodyObject('TPZP', 'E', '', 'true', 'system');
    assert.strictEqual(output.runtimeConfiguration, 'TPZP');
    assert.strictEqual(output.changeType, 'E');
    assert.strictEqual(output.executionStatus, undefined);
  
  });


  it('should be missing dpenvlst', function () {
    let output = index.assembleRequestBodyObject('TPZP', 'E', 'H', null, 'system');
    assert.strictEqual(output.dpenvlst, undefined);
 

    output = index.assembleRequestBodyObject('TPZP', 'E', 'H', undefined, 'system');
    assert.strictEqual(output.dpenvlst, undefined);
  

    output = index.assembleRequestBodyObject('TPZP', 'E', 'H', '', 'system');
    assert.strictEqual(output.dpenvlst, undefined);
  
  });

  
  it('should be missing system', function () {
    let output = index.assembleRequestBodyObject('TPZP', 'E', 'H', 'depenv', null);
    assert.strictEqual(output.system, undefined);
 

    output = index.assembleRequestBodyObject('TPZP', 'E', 'H', 'depenv', undefined);
    assert.strictEqual(output.system, undefined);
  

    output = index.assembleRequestBodyObject('TPZP', 'E', 'H', 'depenv', '');
    assert.strictEqual(output.system, undefined);
  
  });

 
});


describe('#handleResponseBody(responseBody)', function () {
  it('should throw an exception - responseBody undefined', function () {
    assert.throw(function () { index.handleResponseBody(undefined) }, index.DeployFailureException, 'No response was received from the deploy request.');
  });  

  it('should handle an empty message array', function () {
    let responseBody = {
      setId: 'S000241246',
      url: 'http://ces:48226/ispw/cw09-47623/sets/S000241246'
     };
    let output = index.handleResponseBody(responseBody);
    assert.strictEqual(output, responseBody);
  });
});


