import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Commit, CommitSchema } from '../repositories/schemas/commit.schema';
import { Repository, RepositorySchema } from '../repositories/schemas/repository.schema';
import { TimelineController } from './timeline.controller';
import { TimelineRepository } from './timeline.repository';
import { TimelineEvent, TimelineEventSchema } from './schemas/timeline-event.schema';
import { TimelineService } from './timeline.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TimelineEvent.name, schema: TimelineEventSchema },
      { name: Repository.name, schema: RepositorySchema },
      { name: Commit.name, schema: CommitSchema },
    ]),
  ],
  controllers: [TimelineController],
  providers: [TimelineRepository, TimelineService],
  exports: [TimelineService],
})
export class TimelineModule {}
