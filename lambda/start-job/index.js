var AWS = require('aws-sdk');
var mediaconvert = new AWS.MediaConvert({ apiVersion: '2017-08-29' });

exports.handler = async (event, context, callback) => {
  
  console.log("Invoked from S3 Put Object");
  console.log(`REQUEST:: ${JSON.stringify(event, null, 2)}`);
  
  await setMediaConvertEndpoint(mediaconvert);

  const inputPath = 's3://' + event.Records[0].s3.bucket.name + '/' + event.Records[0].s3.object.key;
  const outputPath = 's3://' + process.env.DestinationBucket + '/' + event.guid + '/';

  var params = {
    "Queue": process.env.MediaConvertQueue,
    "JobTemplate": process.env.MediaConvertTemplate,
    "Role": process.env.MediaConvertRole,
    "Settings": {
      "Inputs": [
        {
          "AudioSelectors": {
          "Audio Selector 1": {
            "Offset": 0,
            "DefaultSelection": "DEFAULT",
            "ProgramSelection": 1
            }
          },
          "FileInput": inputPath
        }
      ],
      "OutputGroups": [
        {
          "OutputGroupSettings": {
            "Type": "FILE_GROUP_SETTINGS",
            "FileGroupSettings": {
              "Destination": outputPath
            }
          }
        }
      ]
    }
  };  
  
  await mediaconvert.createJob(params).promise()
    .then(
      function(data) {
        console.log("Job created! ", data);
        event.srcBucket = JSON.stringify(inputPath);
        event.destBucket = JSON.stringify(outputPath);
        event.srcMediaInfo = JSON.stringify(data);
        callback(null, event);
      },
      function(err) {
        console.log("Error", err);
        callback(err, 'Failed');
      }
  );
  
  //set the AWS Account specific mediaconvert endpoint
  async function setMediaConvertEndpoint(mediaconvert){
    mediaconvert.endpoint = process.env.MediaConvertEndpoint;
  }
};
