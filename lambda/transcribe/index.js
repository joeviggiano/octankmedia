var AWS = require('aws-sdk');

exports.handler = async (event, context, callback) => {
  console.log(`REQUEST:: ${JSON.stringify(event, null, 2)}`);

  var transcribe = new AWS.TranscribeService({
      region: process.env.AWS_REGION
  });
  
  
};