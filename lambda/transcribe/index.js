var AWS = require('aws-sdk');

exports.handler = async (event, context, callback) => {
  console.log(`REQUEST:: ${JSON.stringify(event, null, 2)}`);

  const dynamo = new AWS.DynamoDB.DocumentClient({
      region: process.env.AWS_REGION
  });
  
  try {
    let guid = event.Payload.guid;
    delete event.Payload.guid;
    let expression = '';
    let values = {};
    let i = 0;

    Object.keys(event).forEach((key) => {
      i++;
      expression += ' ' + key + ' = :' + i + ',';
      values[':' + i] = event[key];
    });

    let params = {
      TableName: process.env.DynamoDBTable,
      Key: {
          guid: guid,
      },
      // remove the trailing ',' from the update expression added by the forEach loop
      UpdateExpression: 'set ' + expression.slice(0, -1),
      ExpressionAttributeValues: values
  };

  console.log(`UPDATE:: ${JSON.stringify(params, null, 2)}`);
  await dynamo.update(params).promise();

  event.guid = guid;

  } catch (err) {
    console.log(`ERROR:: ${JSON.stringify(err, null, 2)}`);
  }

  return event;
};