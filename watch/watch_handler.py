from aws_lambda_powertools import Logger

LOG = Logger()

@LOG.inject_lambda_context
def watch_existing(event, _):
    services = event['WatchServices']
    tag_filter = event['TagFilter']

    LOG.info('in watch_existing')
    return {'OK': True}
