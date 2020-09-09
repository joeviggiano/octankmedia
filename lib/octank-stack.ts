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
import { Aws, Duration, RemovalPolicy } from '@aws-cdk/core';
import fs = require('fs');
import { Task } from '@aws-cdk/aws-stepfunctions';
import { InvokeFunction } from '@aws-cdk/aws-stepfunctions-tasks';


export class Octank extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Things we'll need later on...
    const stack_name = Aws.STACK_NAME;
    const codeBucket = s3.Bucket.fromBucketAttributes(this, 'octank-cdk-files', {
      bucketArn: 'arn:aws:s3:::octank-cdk-files'
    });

    //Define S3 Buckets:
    var appendRand = Math.random().toString(36).substring(7);
    /*const logBucket = new s3.Bucket(this, 'Octank-logs', {
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY
    });*/

    const destBucket = new s3.Bucket(this, 'Octank-destination', {
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      //serverAccessLogsBucket: logBucket,
      //serverAccessLogsPrefix: 's3-access/',
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const sourceBucket = new s3.Bucket(this, 'Octank-source', {
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      //serverAccessLogsBucket: logBucket,
      //serverAccessLogsPrefix: 's3-access/',
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY
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

    //MediaConvert job templates
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
    const mc_vod_role = new iam.Role(this, 'Octank-mediapackagevod-policy', {
      roleName: 'Octank-mediapackagevod-policy-' + appendRand,
      assumedBy: new iam.ServicePrincipal('mediapackage.amazonaws.com'),
    });
    mc_vod_role.addToPolicy(new iam.PolicyStatement({
      sid: '1',
      actions: ['s3:GetObject', 's3:GetBucketLocation', 's3:GetBucketRequestPayment'],
      resources: [destBucket.bucketArn, destBucket.bucketArn + '/*'],
      effect: iam.Effect.ALLOW
    }));

    //Lambda
    const mc_lambda_sfn = new lambda.Function(this, 'Octank-step-functions', {
      functionName: stack_name + '-step-functions',
      description: 'Creates a unique identifer (GUID) and executes the Ingest StateMachine',
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      code: lambda.Code.fromBucket(codeBucket, 'step-functions.zip'),
      timeout: Duration.seconds(120),
      environment: {
        //TODO: Add ARN's for State Machines here
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        IngestWorkflow: '',
        ProcessWorkflow: '',
        PublishWorkflow: '',
        ErrorHandler: ''
      }
    });

    const mc_lambda_start = new lambda.Function(this, 'Octank-lambda-start', {
      code: new lambda.InlineCode(fs.readFileSync('lambda/start-job/start-job.js', { encoding: 'utf-8'})),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: Duration.seconds(120),
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        MediaConvertEndpoint: 'https://lxlxpswfb.mediaconvert.us-east-1.amazonaws.com',
        MediaConvertRole: '',
        MediaConvertQueue: 'arn:aws:mediaconvert:us-east-1:242707787141:queues/Default',
        MediaConvertTemplate: 'Octank_Ott_1080p_Avc_Aac_16x9_qvbr',
        DestinationBucket: destBucket.bucketArn
      }
    });

    const mc_lambda_ddb = new lambda.Function(this, 'Octank-lambda-ddb', {
      code: new lambda.InlineCode(fs.readFileSync('lambda/start-job/start-job.js', { encoding: 'utf-8'})),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: Duration.seconds(120),
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
      }
    });
    
    //Step Functions, where the magic happens
    //Define Tasks
    const snf_ingest = new sfn.Task(this, 'MediaConvert Ingest', {
      task: new InvokeFunction(mc_lambda_start)
    });
    const snf_ddb = new sfn.Task(this, 'MediaConvert DDB', {
      task: new InvokeFunction(mc_lambda_ddb)
    });

    //Define Chain
    const sfn_chain = sfn.Chain.start(snf_ingest);
    //.next(snf_ddb);

    const mc_ingest_step = new sfn.StateMachine(this, 'Octank-ingest', {
      definition: sfn_chain
    });


    //MediaConvert Rules
    //Define Event Pattern
    const mc_rule_complete :events.EventPattern ={
      source: [
        'aws.mediaconvert'
      ],
      detail: {
        'userMetadata': {
          'workflow': [
            'VOD'
          ]
        },
        'status': [
          'COMPLETE'
        ] 
      }
    }
    const mc_rule_error :events.EventPattern ={
      source: [
        'aws.mediaconvert'
      ],
      detail: {
        'userMetadata': {
          'workflow': [
            'VOD'
          ]
        },
        'status': [
          'ERROR'
        ] 
      }
    }
    
    //Create Event Rules
    const mc_event_complete = new events.CfnRule(this, 'Octank-Encode-Complete',{
      description: 'MediaConvert Completed event rule',
      //TODO: Add Step Function Target - Line:325
      eventPattern: mc_rule_complete
    });
    
    
    const mcevent_event_error = new events.CfnRule(this, 'Octank-Encode-Error',{
      description: 'MediaConvert Error event rule',
      //TODO: Add Step Function Target - Line:345
      eventPattern: mc_rule_error
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