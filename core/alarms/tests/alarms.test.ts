'use strict'

import { test } from 'tap'

import alarms from '../alarms'
import defaultConfig from '../../inputs/default-config'
import { createTestCloudFormationTemplate, albCfTemplate, createTestConfig, testContext } from '../../tests/testing-utils'

test('Alarms create all service alarms', (t) => {
  const cfTemplate = createTestCloudFormationTemplate()
  const funcAlarmPropertiess = {}
  for (const funcLogicalId of Object.keys(cfTemplate.getResourcesByType('AWS::Lambda::Function'))) {
    funcAlarmPropertiess[funcLogicalId] = {}
  }
  const { addAlarms } = alarms(defaultConfig.alarms, funcAlarmPropertiess, testContext)
  addAlarms(cfTemplate)
  const namespaces = new Set()
  for (const resource of Object.values(
    cfTemplate.getResourcesByType('AWS::CloudWatch::Alarm')
  )) {
    if (resource.Properties.Namespace) {
      namespaces.add(resource.Properties.Namespace)
    }
  }
  t.same(namespaces, new Set(['AWS/Lambda', 'AWS/ApiGateway', 'AWS/States', 'AWS/DynamoDB', 'AWS/Kinesis', 'AWS/SQS', 'AWS/ECS', 'AWS/SNS', 'AWS/Events']))
  t.end()
})

test('Alarms create all ALB service alarms', (t) => {
  const cfTemplate = createTestCloudFormationTemplate(albCfTemplate)
  const funcAlarmPropertiess = {}
  for (const funcLogicalId of Object.keys(cfTemplate.getResourcesByType('AWS::Lambda::Function'))) {
    funcAlarmPropertiess[funcLogicalId] = {}
  }
  const { addAlarms } = alarms(defaultConfig.alarms, funcAlarmPropertiess, testContext)
  addAlarms(cfTemplate)
  const namespaces = new Set()
  for (const resource of Object.values(
    cfTemplate.getResourcesByType('AWS::CloudWatch::Alarm')
  )) {
    if (resource.Properties.Namespace) {
      namespaces.add(resource.Properties.Namespace)
    }
  }
  t.same(namespaces, new Set(['AWS/Lambda', 'AWS/ApplicationELB']))
  t.end()
})

test('Alarms are not created when disabled globally', (t) => {
  const config = createTestConfig(
    defaultConfig.alarms,
    {
      ActionsEnabled: false
    }
  )
  const cfTemplate = createTestCloudFormationTemplate()
  const funcAlarmPropertiess = {}
  for (const funcLogicalId of Object.keys(cfTemplate.getResourcesByType('AWS::Lambda::Function'))) {
    funcAlarmPropertiess[funcLogicalId] = {}
  }
  const { addAlarms } = alarms(config, funcAlarmPropertiess, testContext)
  addAlarms(cfTemplate)

  const alarmsCreated = cfTemplate.getResourcesByType('AWS::CloudWatch::Alarm')

  t.same({}, alarmsCreated)
  t.end()
})