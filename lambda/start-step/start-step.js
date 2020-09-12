var AWS = require('aws-sdk');
var uuidv4 = require('uuid/v4');


exports.handler = async (event, context, callback) => {
  
  console.log("Invoke Step Function");
  console.log(event);

  const stepfunctions = new AWS.StepFunctions({
    region: process.env.AWS_REGION
  });

  let response;
  let params;

  try {
    //Generate UUID for each video ingestion pipeline
    //We'll reference this later in DDB and S3
    event.guid = uuidv4();

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
  }

  return response;
};