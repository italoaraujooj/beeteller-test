import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('PIX Beeteller API')
    .setDescription(
      'API para coleta e gerenciamento de mensagens PIX - Desafio Técnico Beeteller',
    ) 
    .setVersion('1.0')
    .addTag('pix', 'Operações relacionadas a mensagens PIX e streams')
    .addTag('utils', 'Endpoints utilitários (ex: geração de dados)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Swagger UI available at ${await app.getUrl()}/docs`);
}
bootstrap();
