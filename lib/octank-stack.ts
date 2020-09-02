import cdk = require('@aws-cdk/core');
import mc = require('@aws-cdk/aws-mediaconvert');
import iam = require('@aws-cdk/aws-iam');
import s3 = require('@aws-cdk/aws-s3');
import sfn = require('@aws-cdk/aws-stepfunctions');
import tasks = require('@aws-cdk/aws-stepfunctions-tasks');
import lambda = require('@aws-cdk/aws-lambda');
import sns = require('@aws-cdk/aws-sns');
import s3n = require('@aws-cdk/aws-s3-notifications');
import { BucketEncryption, BlockPublicAccess } from '@aws-cdk/aws-s3';

export class OctankStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    
    //Define S3 Buckets:
    var appendBucket = Math.random().toString();
    const logBucket = new s3.Bucket(this, 'Octank-logs', {
      bucketName: 'Octank-logs-' + appendBucket,
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED
    });

    const destBucket = new s3.Bucket(this, 'Octank-destination', {
      bucketName: 'Octank-destination-' + appendBucket,
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: 's3-access/',
      encryption: BucketEncryption.S3_MANAGED
    });

    const sourceBucket = new s3.Bucket(this, 'Octank-source', {
      bucketName: 'Octank-source-' + appendBucket,
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: 's3-access/',
      encryption: BucketEncryption.S3_MANAGED
    });

    //Define MediaConvert
    

  }
}
