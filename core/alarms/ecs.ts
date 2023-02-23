'use strict'

import { getResourcesByType, addResource, type ResourceType } from '../cf-template'
import { type Context, createAlarm, type DefaultAlarmsProperties } from './default-config-alarms'
import { type AlarmProperties } from 'cloudform-types/types/cloudWatch/alarm'
import type Template from 'cloudform-types/types/template'

export interface EcsAlarmsConfig {
  enabled?: boolean
  MemoryUtilization: DefaultAlarmsProperties
  CPUUtilization: DefaultAlarmsProperties
}

export type EcsAlarm = AlarmProperties & {
  ServiceName: string
  ClusterName: string
}

type EcsMEtrics = 'MemoryUtilization' | 'CPUUtilization'

/**
 * Given CloudFormation syntax for an ECS cluster, derive CloudFormation syntax for
 * the cluster's name
 *
 * @param  cluster CloudFormation syntax for an ECS cluster
 * @returns CloudFormation syntax for the cluster's name
 */
export function resolveEcsClusterNameAsCfn (cluster): any {
  if (typeof cluster === 'string') {
    if (cluster.startsWith('arn:')) {
      return cluster.split(':').pop()?.split('/').pop()
    }
    return cluster
  }
  if (cluster.GetAtt != null && cluster.GetAtt[1] === 'Arn') {
    // AWS::ECS::Cluster returns the cluster name for 'Ref'
    return { Ref: cluster.GetAtt[0] }
  }
  return cluster // Fallback to name
}

const executionMetrics: EcsMEtrics[] = ['MemoryUtilization', 'CPUUtilization']

/**
 * ecsAlarmsConfig The fully resolved alarm configuration
 */
export default function createECSAlarms (ecsAlarmsConfig: EcsAlarmsConfig, context: Context, compiledTemplate: Template, additionalResources: ResourceType = {}) {
  /**
   * Add all required ECS alarms to the provided CloudFormation template
   * based on the ECS Service resources
   *
   * A CloudFormation template object
   */
  const serviceResources = getResourcesByType('AWS::ECS::Service', compiledTemplate, additionalResources)

  for (const [serviceResourceName, serviceResource] of Object.entries(serviceResources)) {
    for (const metric of executionMetrics) {
      const cluster = serviceResource.Properties?.Cluster
      const clusterName = resolveEcsClusterNameAsCfn(cluster)
      const config = ecsAlarmsConfig[metric]
      if (config.enabled !== false) {
        const threshold = config.Threshold
        const ecsAlarmProperties: EcsAlarm = {
          AlarmName: `ECS_${metric.replaceAll('Utilization', 'Alarm')}_\${${serviceResourceName}.Name}`,
          AlarmDescription: `ECS ${metric} for ${serviceResourceName}.Name breaches ${threshold}`,
          ServiceName: `\${${serviceResourceName}.Name}`,
          ClusterName: clusterName,
          MetricName: metric,
          Namespace: 'AWS/ECS',
          Dimensions: [
            { Name: 'ServiceName', Value: `\${${serviceResourceName}.Name}` },
            { Name: 'ClusterName', Value: clusterName }
          ],
          ...config
        }
        const resourceName = `slicWatch${metric}Alarm${serviceResourceName}`
        const resource = createAlarm(ecsAlarmProperties, context)
        addResource(resourceName, resource, compiledTemplate)
      }
    }
  }
}
