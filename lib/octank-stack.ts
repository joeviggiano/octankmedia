import cdk = require('@aws-cdk/core');
import mc = require('@aws-cdk/aws-mediaconvert');
import iam = require('@aws-cdk/aws-iam');
import s3 = require('@aws-cdk/aws-s3');
import sfn = require('@aws-cdk/aws-stepfunctions');
import tasks = require('@aws-cdk/aws-stepfunctions-tasks');
import lambda = require('@aws-cdk/aws-lambda');
import sns = require('@aws-cdk/aws-sns');
import s3n = require('@aws-cdk/aws-s3-notifications');
import ddb = require('@aws-cdk/aws-dynamodb');
import events = require('@aws-cdk/aws-events');
import { BucketEncryption, BlockPublicAccess } from '@aws-cdk/aws-s3';
import * as vod720preset from '../presets/720p.json';
import * as vod1080preset from '../presets/1080p.json';
import * as vod2160preset from '../presets/2160p.json';
import * as vod720job from '../jobtemplates/720p.json';
import * as vod1080job from '../jobtemplates/1080p.json';
import * as vod2160job from '../jobtemplates/2160p.json';
import { CfnTable } from '@aws-cdk/aws-dynamodb';
import { Aws } from '@aws-cdk/core';


export class OctankStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const stack_name = Aws.STACK_NAME;

    //Define S3 Buckets:
    var appendRand = Math.random().toString(36).substring(7);
    const logBucket = new s3.Bucket(this, 'Octank-logs', {
      bucketName: 'octank-logs-' + appendRand,
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED
    });

    const destBucket = new s3.Bucket(this, 'Octank-destination', {
      bucketName: 'octank-destination-' + appendRand,
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: 's3-access/',
      encryption: BucketEncryption.S3_MANAGED
    });

    const sourceBucket = new s3.Bucket(this, 'Octank-source', {
      bucketName: 'octank-source-' + appendRand,
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: logBucket,
      serverAccessLogsPrefix: 's3-access/',
      encryption: BucketEncryption.S3_MANAGED
    });

    //Define MediaConvert
    //Let's first create our MediaConvert output presets
    const vod720p = new mc.CfnPreset(this, 'Octank_Mp4_Avc_Aac_16x9_1280x720p_24Hz_4.5Mbps_qvbr', {
      name: 'Octank_Mp4_Avc_Aac_16x9_1280x720p_24Hz_4.5Mbps_qvbr',
      category: 'VOD',
      description: 'Octank_Mp4_Avc_Aac_16x9_1280x720p_24Hz_4.5Mbps_qvbr',
      settingsJson: vod720preset.Settings
    });

    const vod1080p = new mc.CfnPreset(this, 'Octank_Mp4_Avc_Aac_16x9_1920x1080p_24Hz_6Mbps_qvbr', {
      name: 'Octank_Mp4_Avc_Aac_16x9_1920x1080p_24Hz_6Mbps_qvbr',
      category: 'VOD',
      description: 'Octank_Mp4_Avc_Aac_16x9_1920x1080p_24Hz_6Mbps_qvbr',
      settingsJson: vod1080preset.Settings
    });

    const vod2160p = new mc.CfnPreset(this, 'Octank_Mp4_Hevc_Aac_16x9_3840x2160p_24Hz_20Mbps_qvbr', {
      name: 'Octank_Mp4_Hevc_Aac_16x9_3840x2160p_24Hz_20Mbps_qvbr',
      category: 'VOD',
      description: 'Octank_Mp4_Hevc_Aac_16x9_3840x2160p_24Hz_20Mbps_qvbr',
      settingsJson: vod2160preset.Settings
    });

    //OK phew, that's done, now the MediaConvert job templates!
    const job720p = new mc.CfnJobTemplate(this, 'Octank_Ott_720p_Avc_Aac_16x9_qvbr', {
      name: 'Octank_Ott_720p_Avc_Aac_16x9_qvbr',
      category: 'VOD',
      description: 'Octank_Ott_720p_Avc_Aac_16x9_qvbr',
      settingsJson: vod720job.Settings
    });

    const job1080p = new mc.CfnJobTemplate(this, 'Octank_Ott_1080p_Avc_Aac_16x9_qvbr', {
      name: 'Octank_Ott_1080p_Avc_Aac_16x9_qvbr',
      category: 'VOD',
      description: 'Octank_Ott_1080p_Avc_Aac_16x9_qvbr',
      settingsJson: vod1080job.Settings
    });

    const job2160p = new mc.CfnJobTemplate(this, 'Octank_Ott_2160p_Avc_Aac_16x9_qvbr', {
      name: 'Octank_Ott_2160p_Avc_Aac_16x9_qvbr',
      category: 'VOD',
      description: 'Octank_Ott_2160p_Avc_Aac_16x9_qvbr',
      settingsJson: vod2160job.Settings
    });

    //MediaConvert IAM Roles
    const mc_vod_role = new iam.Role(this, stack_name + '-mediapackagevod-policy', {
      roleName: stack_name + '-mediapackagevod-policy',
      assumedBy: new iam.ServicePrincipal('mediapackage.amazonaws.com')
    });
    mc_vod_role.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:GetBucketLocation', 's3:GetBucketRequestPayment'],
      resources: [destBucket.bucketArn, destBucket.bucketArn + '/*'],
      sid: stack_name + '-mediapackagevod-policy',
      effect: iam.Effect.ALLOW
    }));

    //MediaConvert Rules
    const mcevent_complete = new events.CfnRule(this, 'Octank-EncodeComplete',{
      name: 'Octank-EncodeComplete',
      description: 'MediaConvert Completed event rule',
      //TODO: Add Step Function Target - Line:325
      eventPattern: '{ "source": [ "aws.mediaconvert" ], "detail": {"status": ["COMPLETE"]} }'
    });

    const mcevent_error = new events.CfnRule(this, 'Octank-EncodeComplete',{
      name: 'Octank-EncodeComplete',
      description: 'MediaConvert Completed event rule',
      //TODO: Add Step Function Target - Line:345
      eventPattern: '{ "source": [ "aws.mediaconvert" ], "detail": {"status": ["ERROR"]} }'
    });

    //Time for DynamoDB!
    const table = new ddb.CfnTable(this, 'Octank-Table', {
      tableName: 'Octank-Table',
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      attributeDefinitions: [
        {
          attributeName: "guid",
          attributeType: "S"
        },{
          attributeName: "srcBucket",
          attributeType: "S"
        },{
          attributeName: "startTime",
          attributeType: "S"
        }
      ],
      keySchema: [
        {
          attributeName: "guid",
          keyType: "HASH"
        }
      ],
      globalSecondaryIndexes: [
        {
          indexName: "srcBucket-startTime-index",
          keySchema: [
            {
              attributeName: "srcBucket",
              keyType: "HASH"
            },{
              attributeName: "startTime",
              keyType: "RANGE"
            }
          ],
            projection: {
              projectionType: "ALL"
            }
        }
      ]
    });

  }
}