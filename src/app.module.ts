import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PixMessagesModule } from './pix-messages/pix-messages.module';
import { ActiveStreamsModule } from './active-streams/active-streams.module';
import { UtilsModule } from './utils/utils.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env', 
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule], 
      inject: [ConfigService], 
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST', 'localhost'),
        port: parseInt(configService.get<string>('POSTGRES_PORT', '4321')),
        username: configService.get<string>('POSTGRES_USER', 'admin'),
        password: configService.get<string>('POSTGRES_PASSWORD', 'admin123'),
        database: configService.get<string>('POSTGRES_DB', 'pix_db'),
        entities: [],
        autoLoadEntities: true, 
        synchronize: true, // Em desenvolvimento, cria/atualiza tabelas automaticamente. Não usar em produção!
        logging: configService.get<string>('NODE_ENV') === 'development', // Loga queries SQL em desenvolvimento
      }),
    }),
    PixMessagesModule,
    ActiveStreamsModule,
    UtilsModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
