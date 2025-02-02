import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.NODE_ENV !== 'production' ? '*' : false
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
