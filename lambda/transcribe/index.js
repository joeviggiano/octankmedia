var AWS = require('aws-sdk');

exports.handler = async (event, context, callback) => {
  console.log(`REQUEST:: ${JSON.stringify(event, null, 2)}`);

  var transcribe = new AWS.TranscribeService({
      region: process.env.AWS_REGION
  });

  
  var sourcemp4;
  var jobname = 'transcribe_' + event.detail.userMetadata.guid;
  
  if(event.detail.outputGroupDetails[0].outputDetails.length > 1) {
    sourcemp4 = event.detail.outputGroupDetails[0].outputDetails[1].outputFilePaths;
  } else {
    sourcemp4 = event.detail.outputGroupDetails[0].outputDetails[0].outputFilePaths;
  }
  sourcemp4 = JSON.parse(JSON.stringify(sourcemp4));

  await transcribe.startTranscriptionJob({
    LanguageCode: 'en-US',
    Media: { MediaFileUri: sourcemp4[0] },
    MediaFormat: 'mp4',
    TranscriptionJobName: jobname,
    OutputBucketName: process.env.DestinationBucket,
  }).promise()
  .then(
    function(data) {
      console.log("Job created! ", data);
      callback(null, event);
    },
    function(err) {
      console.log("Error", err);
      callback(err, 'Failed');
    }
  );
};