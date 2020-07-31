const Inert = require('@hapi/inert');
const Vision = require('@hapi/vision');
const HapiSwagger = require('hapi-swagger');
const Package = require('../../../package.json');


module.exports = {
  name: 'app-swagger',
  async register(server) {
    await server.register([
      Inert,
      Vision,
      {
        plugin: HapiSwagger,
        options: {
          validatorUrl: null,
          info: {
            title: 'NG Sansaar API Docs',
            version: Package.version,
          },
          securityDefinitions: {
            jwt: {
              type: 'apiKey',
              name: 'Authorization',
              in: 'header',
            },
          },
          security: [{ jwt: [] }]
        },
      },
    ]);
  },
};
