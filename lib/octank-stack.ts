import cdk = require('@aws-cdk/core');
import mc = require('@aws-cdk/aws-mediaconvert');
import iam = require('@aws-cdk/aws-iam');
import s3 = require('@aws-cdk/aws-s3');
import sfn = require('@aws-cdk/aws-stepfunctions');
import tasks = require('@aws-cdk/aws-stepfunctions-tasks');
import lambda = require('@aws-cdk/aws-lambda');
import sns = require('@aws-cdk/aws-sns');
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
import s3event = require('@aws-cdk/aws-lambda-event-sources');


export class Octank extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //*********************************//
    //********   S3 BUCKETS   ********//
    //*******************************//
    const stack_name = Aws.STACK_NAME;
    const codeBucket = s3.Bucket.fromBucketAttributes(this, 'octank-cdk-files', {
      bucketArn: 'arn:aws:s3:::octank-cdk-files'
    });

    var appendRand = Math.random().toString(36).substring(7);

    const destBucket = new s3.Bucket(this, 'Octank-destination', {
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const sourceBucket = new s3.Bucket(this, 'Octank-source', {
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY
    });


    //*********************************//
    //********    DYNAMODB    ********//
    //*******************************//
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
    const mc_ddb_role = new iam.Role(this, 'Octank-ddb-role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    });
    mc_ddb_role.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowDDB',
      actions: ['dynamodb:*'],
      resources: [table.attrArn],
      effect: iam.Effect.ALLOW
    }));
    mc_ddb_role.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowLogs',
      actions: ['logs:CreateLogGroup','logs:CreateLogStream','logs:PutLogEvents'],
      resources: ['*'],
      effect: iam.Effect.ALLOW
    }));


    //*********************************//
    //********  MEDIACONVERT  ********//
    //*******************************//
    //MediaConvert output presets
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
    const mc_output_role = new iam.Role(this, 'Octank-mediaconvert-output', {
      assumedBy: new iam.ServicePrincipal('mediaconvert.amazonaws.com'),
    });
    mc_output_role.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowS3',
      actions: ['s3:*Object', 's3:GetBucketLocation', 's3:GetBucketRequestPayment'],
      resources: [destBucket.bucketArn, destBucket.bucketArn + '/*', sourceBucket.bucketArn, sourceBucket.bucketArn + '/*'],
      effect: iam.Effect.ALLOW
    }));
    mc_output_role.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowMediaConvert',
      actions: ['mediaconvert:*'],
      resources: ['arn:aws:mediaconvert:*:*:*'],
      effect: iam.Effect.ALLOW
    }));

    const mc_encode_role = new iam.Role(this, 'Octank-mediaconvert-encode', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    });
    mc_encode_role.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowMediaConvert',
      actions: ['mediaconvert:*'],
      resources: ['arn:aws:mediaconvert:*:*:*'],
      effect: iam.Effect.ALLOW
    }));

    const mc_start_role = new iam.Role(this, 'Octank-mediaconvert-start', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    mc_start_role.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowLogs',
      actions: ['logs:CreateLogGroup','logs:CreateLogStream','logs:PutLogEvents'],
      resources: ['*'],
      effect: iam.Effect.ALLOW
    }));
    mc_start_role.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowMediaConvert',
      actions: ['mediaconvert:*'],
      resources: ['arn:aws:mediaconvert:*:*:*'],
      effect: iam.Effect.ALLOW
    }));
    mc_start_role.addToPolicy(new iam.PolicyStatement({
      sid: 'AllowPassRole',
      actions: ['iam:PassRole'],
      resources: [mc_encode_role.roleArn, mc_output_role.roleArn],
      effect: iam.Effect.ALLOW
    }));


    //*********************************//
    //********     LAMBDA     ********//
    //*******************************//
    const mc_lambda_start = new lambda.Function(this, 'Octank-lambda-start', {
      code: new lambda.InlineCode(fs.readFileSync('lambda/start-job/index.js', { encoding: 'utf-8'})),
      description: 'Creates and Executes MediaConvert Job',
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: Duration.seconds(120),
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        MediaConvertEndpoint: 'https://lxlxpswfb.mediaconvert.us-east-1.amazonaws.com',
        MediaConvertRole: mc_output_role.roleArn,
        MediaConvertQueue: 'arn:aws:mediaconvert:us-east-1:242707787141:queues/Default',
        MediaConvertTemplate: 'Octank_Ott_1080p_Avc_Aac_16x9_qvbr',
        DestinationBucket: destBucket.bucketName
      },
      role: mc_start_role
    });

    const mc_lambda_ddb = new lambda.Function(this, 'Octank-lambda-ddb', {
      code: new lambda.InlineCode(fs.readFileSync('lambda/ddb/index.js', { encoding: 'utf-8'})),
      description: 'Add MediaConvert Job Info to DDB',
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: Duration.seconds(120),
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        DynamoDBTable: 'Octank-Table'
      },
      role: mc_ddb_role
    });

    const mc_lambda_transcribe = new lambda.Function(this, 'Octank-lambda-transcribe', {
      code: new lambda.InlineCode(fs.readFileSync('lambda/transcribe/index.js', { encoding: 'utf-8'})),
      description: 'Run Transcribe Job',
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: Duration.seconds(120),
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
      },
    });
    

    //*********************************//
    //******** STEP FUNCTIONS ********//
    //*******************************//
    //Define Step Function Tasks
    const snf_ingest = new tasks.LambdaInvoke(this, 'MediaConvert Ingest', {
      lambdaFunction: mc_lambda_start
    });
    const snf_ddb = new tasks.LambdaInvoke(this, 'MediaConvert DDB', {
      lambdaFunction: mc_lambda_ddb
    });

    //Define Step Function Chain
    const sfn_chain = sfn.Chain.start(snf_ingest)
    .next(snf_ddb);
    const mc_ingest_step = new sfn.StateMachine(this, 'Octank-ingest', {
      definition: sfn_chain
    });

    //Define S3 Event
    const uploadEvent = new s3event.S3EventSource(
      sourceBucket, {
        events: [s3.EventType.OBJECT_CREATED]
      }
    );

    //Lambda to kick off step function
    //This function will get called on S3 OBJECT_CREATED event
    const mc_lambda_step = new lambda.Function(this, 'Octank-lambda-step', {
      code: lambda.Code.fromBucket(codeBucket, 'start-step.zip'),
      description: 'S3 Event Listener and Starts Ingestion Step Function',
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: Duration.seconds(120),
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        IngestStepFunction: mc_ingest_step.stateMachineArn
      },
      events: [uploadEvent]
    });
    mc_ingest_step.grantStartExecution(mc_lambda_step);
    sourceBucket.grantReadWrite(mc_lambda_step);
    sourceBucket.encryptionKey?.grant(mc_lambda_step);
   

    //*********************************//
    //********     EVENTS     ********//
    //*******************************//
    //Define Event Patterns
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

  }
}