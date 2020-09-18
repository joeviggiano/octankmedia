var AWS = require('aws-sdk');

exports.handler = async (event, context, callback) => {
  console.log(`REQUEST:: ${JSON.stringify(event, null, 2)}`);

  const dynamo = new AWS.DynamoDB.DocumentClient({
      region: process.env.AWS_REGION
  });
  const s3 = new AWS.S3();
  
  let params = { 
    TableName: process.env.DynamoDBTable 
  };

  var s3params = {
    Bucket: process.env.DestinationBucket,
    Prefix: event.guid
  };

    let scanResults = [];
    var s3Results = [];
    var s3Urls = [];
    let items;
    
    do {
        items = await dynamo.scan(params).promise();
        items.Items.forEach(function(tbl) {
          scanResults.push(tbl.guid);
        });
        params.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (typeof items.LastEvaluatedKey != "undefined");

    for (let i = 0; i < scanResults.length; i++) {

      var s3params = {
        Bucket: process.env.DestinationBucket,
        Prefix: scanResults[i]
      };

      const data = await s3.listObjects(s3params).promise();

      for (let index = 0; index < data['Contents'].length; index++) {
        if(index == 0) {
          s3Results.push('transcribe_' + scanResults[i]+ '.json');
        }
        s3Results.push(data['Contents'][index]['Key']);
      }
    }

    for (let i = 0; i < s3Results.length; i++) {
      var urlparams = {
        Bucket: process.env.DestinationBucket, 
        Key: s3Results[i],
        Expires: 600
      };
      s3Urls.push(s3.getSignedUrl('getObject', urlparams));
    }

    callback(null, s3Urls);
};