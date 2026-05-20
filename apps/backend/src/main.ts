import 'reflect-metadata';
import './load-env';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, static as serveStatic, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ensureContentAssetsDir, getContentAssetsPublicPrefix } from './content/content-assets';
import { DatabaseUnavailableFilter } from './prisma/database-unavailable.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  app.enableCors({ origin: corsOrigin || true, credentials: true });
  app.use(json({ limit: '1gb' }));
  app.use(urlencoded({ extended: true, limit: '1gb' }));
  const contentAssetsDir = ensureContentAssetsDir();
  const contentAssetsPrefix = getContentAssetsPublicPrefix();
  app.use(contentAssetsPrefix, serveStatic(contentAssetsDir, { maxAge: '7d' }));
  app.use(`/api${contentAssetsPrefix}`, serveStatic(contentAssetsDir, { maxAge: '7d' }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new DatabaseUnavailableFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

bootstrap();
