/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { Esqueue } from '@castro/esqueue';
import * as Hapi from 'hapi';
import { resolve } from 'path';

import { mappings } from './mappings';
import { CloneWorker, DeleteWorker, UpdateWorker } from './server/queue';
import { exampleRoute } from './server/routes/example';
import { fileRoute } from './server/routes/file';
import { lspRoute } from './server/routes/lsp';
import { monacoRoute } from './server/routes/monaco';
import { repositoryRoute } from './server/routes/repository';
import { ServerOptions } from './server/ServerOptions';

// tslint:disable-next-line no-default-export
export default (kibana: any) =>
  new kibana.Plugin({
    require: ['elasticsearch'],
    name: 'castro',
    publicDir: resolve(__dirname, 'public'),
    uiExports: {
      app: {
        title: 'Castro',
        description: 'castro',
        main: 'plugins/castro/app',
        styleSheetPath: resolve(__dirname, 'public/styles.scss'),
      },

      hacks: ['plugins/castro/hack'],

      mappings,
    },

    config(Joi: any) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
        dataPath: Joi.string().default('/tmp'),
        queueIndex: Joi.string().default('.castro-worker-queue'),
        updateFreqencyMs: Joi.number().default(5 * 60 * 1000), // 5 minutes by default.
      }).default();
    },

    init(server: Hapi.Server, options: any) {
      const queueIndex = server.config().get('castro.queueIndex');
      const queue = new Esqueue(queueIndex, {
        // We may consider to provide a different value
        doctype: 'esqueue',
        dataSeparator: '.',
        client: server.plugins.elasticsearch.getCluster('admin').getClient(),
      });

      const cloneWorker = new CloneWorker(queue, server);
      const deleteWorker = new DeleteWorker(queue, server);
      const updateWorker = new UpdateWorker(queue, server);

      cloneWorker.bind();
      deleteWorker.bind();
      updateWorker.bind();

      server.expose('cloneWorker', cloneWorker);
      server.expose('deleteWorker', deleteWorker);
      server.expose('updateWorker', updateWorker);

      const serverOptions = new ServerOptions(options);
      const client = server.plugins.elasticsearch.getCluster('admin');
      const callCluster = async (method: string, params: any) => {
        await client.callWithInternalUser(method, params);
      };

      const schedulerOpts: UpdateSchedulerOptions = {
        updateFrequencyMs: server.config().get('castro.updateFreqencyMs'),
        serverOptions,
      };
      const scheduler = new UpdateScheduler(updateWorker, schedulerOpts, callCluster);
      scheduler.start();

      // Add server routes and initialize the plugin here
      exampleRoute(server);
      lspRoute(server, serverOptions);
      repositoryRoute(server, serverOptions);
      fileRoute(server, serverOptions);
      monacoRoute(server);
    },
  });
