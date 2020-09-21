# Octank Media POC CDK Project

This is a POC project for Octank Media to show video encoding on AWS.

![Image of Diagram](https://github.com/joeviggiano/octankmedia/blob/master/assets/diagram-github.jpg)


## What to update when you deploy:

* `MediaConvertEndpoint`    The unique MediaConvert Endpoint for your account and region (line 248 of octank-stack.ts)
* `MediaConvertQueue`       The default MediaConvert queue ARN for your account and region (line 250 of octank-stack.ts)



## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
