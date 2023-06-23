import { merge } from 'lodash'
import Ajv from 'ajv'
import Serverless from 'serverless'
import type Hooks from 'serverless-hooks-plugin'

import { type ResourceType } from '../core/index'
import { addAlarms, addDashboard, pluginConfigSchema, functionConfigSchema, slicWatchSchema, defaultConfig } from '../core/index'

interface SlicWatchConfig {
  topicArn?: string
  enabled?: boolean
}

class ServerlessPlugin {
  serverless: Serverless
  hooks: Hooks

  /**
     * Plugin constructor according to the Serverless Framework v2/v3 plugin signature
     * @param {*} serverless The Serverless instance
     */
  constructor (serverless: Serverless) {
    this.serverless = serverless

    if (serverless.service.provider.name !== 'aws') {
      throw new Serverless('SLIC Watch only supports AWS')
    }

    if (serverless.configSchemaHandler != null) {
      serverless.configSchemaHandler.defineCustomProperties(pluginConfigSchema)
      serverless.configSchemaHandler.defineFunctionProperties('aws', functionConfigSchema)
    }

    // Use the latest possible hook to ensure that `Resources` are included in the compiled Template
    this.hooks = { 'after:aws:package:finalize:mergeCustomProviderResources': this.createSlicWatchResources.bind(this) }
  }

  /**
     * Modify the CloudFormation template before the package is finalized
     */
  createSlicWatchResources () {
    const slicWatchConfig: SlicWatchConfig = this.serverless.service.custom?.slicWatch ?? {}

    const ajv = new Ajv({
      unicodeRegExp: false
    })
    const slicWatchValidate = ajv.compile(slicWatchSchema)
    const slicWatchValid = slicWatchValidate(slicWatchConfig)
    if (!slicWatchValid) {
      throw new Serverless('SLIC Watch configuration is invalid: ' + ajv.errorsText(slicWatchValidate.errors))
    }

    const alarmActions: string[] = []

    if (!(slicWatchConfig.enabled !== false)) {
      return
    }

    slicWatchConfig.topicArn != null && alarmActions.push(slicWatchConfig.topicArn)

    // Validate and fail fast on config validation errors since this is a warning in Serverless Framework 2.x
    const context = { alarmActions }

    const config = merge(defaultConfig, slicWatchConfig)
    const awsProvider = this.serverless.getProvider('aws')

    const functionAlarmConfigs = {}
    const functionDashboardConfigs = {}
    for (const funcName of this.serverless.service.getAllFunctions()) {
      const func = this.serverless.service.getFunction(funcName) as any // check why they don't return slicWatch
      const functionResName = awsProvider.naming.getLambdaLogicalId(funcName)
      const funcConfig = func.slicWatch ?? {}
      functionAlarmConfigs[functionResName] = funcConfig.alarms ?? {}
      functionDashboardConfigs[functionResName] = funcConfig.dashboard
    }

    const compiledTemplate = this.serverless.service.provider.compiledCloudFormationTemplate
    const additionalResources = this.serverless.service.resources as ResourceType

    merge(compiledTemplate, additionalResources)
    addDashboard(config.dashboard, functionDashboardConfigs, compiledTemplate)
    addAlarms(config.alarms, functionAlarmConfigs, context, compiledTemplate)
  }
}

export default ServerlessPlugin