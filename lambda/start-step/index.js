var AWS = require('aws-sdk');

const {
  NIL: NIL_UUID,
  parse: uuidParse,
  stringify: uuidStringify,
  v1: uuidv1,
  v3: uuidv3,
  v4: uuidv4,
  v5: uuidv5,
  validate: uuidValidate,
  version: uuidVersion,
} = require('uuid');
const uuid = require('uuid');
const pkg = require('uuid/package.json');


exports.handler = async (event, context, callback) => {
  
  console.log("Invoke Step Function");
  console.log(`REQUEST:: ${JSON.stringify(event, null, 2)}`);

  const stepfunctions = new AWS.StepFunctions({
    region: process.env.AWS_REGION
  });

  let response;
  let params;

  try {
    //Generate UUID for each video ingestion pipeline
    //We'll reference this later in DDB and S3
    event.guid = uuidv4();
    console.log(event.guid);
    
    params = {
      stateMachineArn: process.env.IngestStepFunction,
      input: JSON.stringify(event),
      name: event.guid
    };

    let data = await stepfunctions.startExecution(params).promise();
    console.log(`STATEMACHINE EXECUTE:: ${JSON.stringify(data, null, 2)}`);
    response = 'success';
  } catch (err) {
    response = 'error';
    console.log(`ERROR:: ${JSON.stringify(err, null, 2)}`);
  }

  return response;
};