import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import type { ConnectOptions } from 'mongoose';
import * as os from 'node:os';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        ({
          uri: config.getOrThrow<string>('MONGO_URI'),
          serverSelectionTimeoutMS: 5000,
          // The MongoDB 7.x driver otherwise loads its `os` adapter with a dynamic
          // import(), which is unavailable in Jest's CommonJS sandbox. Passing the
          // adapter explicitly keeps runtime and test connections identical.
          runtimeAdapters: { os },
        }) as ConnectOptions & { runtimeAdapters: { os: typeof os } },
    }),
  ],
})
export class DatabaseModule {}
