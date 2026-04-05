import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/validation-exception.filter';

/**
 * Interactive API reference: Zorvyn header + RapiDoc (Try it, JWT auth — no Swagger UI).
 * @see https://rapidocweb.com/
 */
function buildDocsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Financial Backend — Zorvyn</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    .zb-bar {
      background: #1b1b3a;
      color: #fff;
      padding: 10px 24px;
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 1px solid #2a2d52;
    }
    .zb-circle {
      width: 48px;
      height: 48px;
      min-width: 48px;
      border-radius: 50%;
      background: #85ea2d;
      color: #1b1b3a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      font-family: Consolas, Monaco, monospace;
    }
    .zb-t1 { font-size: 1.55rem; font-weight: 500; letter-spacing: -0.02em; }
    .zb-t2 { font-size: 0.72rem; margin-top: 6px; opacity: 0.96; }
    .zb-t2 b { font-weight: 800; letter-spacing: 0.08em; }
    .zb-ver {
      font-size: 10px;
      font-weight: 600;
      padding: 3px 9px;
      border: 1px solid rgba(255,255,255,0.5);
      border-radius: 4px;
      margin-left: 6px;
      white-space: nowrap;
    }
    rapi-doc { height: calc(100vh - 76px); display: block; }
  </style>
  <script type="module" src="https://unpkg.com/rapidoc@9.3.4/dist/rapidoc-min.js"></script>
</head>
<body>
  <header class="zb-bar" role="banner">
    <div class="zb-circle" aria-hidden="true">{ ··· }</div>
    <div>
      <div class="zb-t1">Financial Backend</div>
      <div class="zb-t2">supported by <b>ZORVYN</b></div>
    </div>
    <span class="zb-ver">Updated V0.9</span>
  </header>
  <rapi-doc
    spec-url="/openapi.json"
    show-header="false"
    allow-authentication="true"
    allow-server-selection="false"
    render-style="read"
    theme="light"
    primary-color="#1b1b3a"
    nav-bg-color="#1b1b3a"
    nav-text-color="#ffffff"
    regular-font="system-ui, -apple-system, Segoe UI, sans-serif"
  ></rapi-doc>
</body>
</html>`;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({ origin: true });

  const port = process.env.PORT ?? '3000';
  const publicBase =
    process.env.PUBLIC_API_URL?.replace(/\/$/, '') || `http://127.0.0.1:${port}`;

  const config = new DocumentBuilder()
    .setTitle('Financial Backend')
    .setDescription(
      '*Supported by Zorvyn*\n\n' +
        '**Updated V0.9** — Interactive reference below: log in with **POST /auth/login**, then set the **JWT** ' +
        '(paste **only** the `access_token`; the client sends standard `Authorization: Bearer …` — see README).',
    )
    .setVersion('Updated V0.9')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste **only** the `access_token` from login. Do **not** type the word `Bearer` yourself.',
      },
      'JWT',
    )
    .addServer(publicBase, 'API')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const server = app.getHttpAdapter().getInstance();
  server.get('/openapi.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(document);
  });
  server.get('/docs', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildDocsPage());
  });

  await app.listen(Number(port));
  // eslint-disable-next-line no-console
  console.log(`Application is running on: http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`API reference: http://localhost:${port}/docs`);
}

bootstrap();
