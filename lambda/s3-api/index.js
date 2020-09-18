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

    let scanResults = [];
    let items;
    
    do {
        items = await dynamo.scan(params).promise();
        //items.Items.forEach((item) => scanResults.push(item));
        items.Items.forEach(function(tbl) {
          scanResults.push(tbl.guid);
        });
        params.ExclusiveStartKey = items.LastEvaluatedKey;
    } while (typeof items.LastEvaluatedKey != "undefined");

    callback(null, scanResults);
};