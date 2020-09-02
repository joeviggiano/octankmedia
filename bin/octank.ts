#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { OctankStack } from '../lib/octank-stack';

const app = new cdk.App();
new OctankStack(app, 'OctankStack');
