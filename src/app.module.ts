import { McpApp, Module, ConfigModule } from '@nitrostack/core';
import { IdeationGoatModule } from './modules/ideation-goat/ideation-goat.module.js';
import { SystemHealthCheck } from './health/system.health.js';

/**
 * Root Application Module
 * 
 * This is the main module that bootstraps the MCP server.
 * It registers all feature modules and health checks.
 */
@McpApp({
  module: AppModule,
  server: {
    name: 'IdeationGOAT',
    version: '1.0.0'
  },
  logging: {
    level: 'info'
  }
})
@Module({
  name: 'app',
  description: 'Ideation GOAT MCP server',
  imports: [
    ConfigModule.forRoot(),
    IdeationGoatModule
  ],
  providers: [
    // Health Checks
    SystemHealthCheck,
  ]
})
export class AppModule { }
