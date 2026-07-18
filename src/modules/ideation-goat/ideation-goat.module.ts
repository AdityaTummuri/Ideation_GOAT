import { Module } from '@nitrostack/core';
import { IdeationGoatTools } from './ideation-goat.tools.js';

@Module({
  name: 'ideation-goat',
  description: 'Cross-Domain Cross-Pollination & Ideation Engine for AI Agents',
  controllers: [IdeationGoatTools]
})
export class IdeationGoatModule {}
