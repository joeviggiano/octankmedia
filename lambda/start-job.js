var AWS = require('aws-sdk');
var mediaconvert = new AWS.MediaConvert({ apiVersion: '2017-08-29' });

exports.handler = async (event, context, callback) => {
  
  console.log("Invoked from S3 Put Object");
  console.log(event);
  
  await setMediaConvertEndpoint(mediaconvert);

  var bucket = event.Records[0].s3.bucket.name;
  var key = event.Records[0].s3.object.key;

  var params = {
    "Queue": "arn:aws:mediaconvert:us-east-1:242707787141:queues/Default",
    "JobTemplate": "Octank-MediaConvert-JobTemplate",
    "Role": "arn:aws:iam::266215515421:role/Octank-Video-Transcoding-MediaConvertJobRole-MGOJKHPLXGRA",
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
          "FileInput": "s3://" + bucket + "/" + key
        }
      ]
    }
  };  
  
  await mediaconvert.createJob(params).promise()
    .then(
      function(data) {
        console.log("Job created! ", data);
        callback(null, 'Done');
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
