// IMPORTANT: Must be imported first to extend Zod globally
import './init';

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import transactionsRouter from './routes/transactions';
import accountsRouter from './routes/accounts';
import usersRouter from './routes/users';
import v2AccountsRouter from './routes/v2/accounts';
import v2TransactionsRouter from './routes/v2/transactions';
import { openApiSpec } from './openapi';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Version 1 API routes
const v1Router = express.Router();
v1Router.use('/', transactionsRouter);
v1Router.use('/', accountsRouter);
v1Router.use('/', usersRouter);
app.use('/v1', v1Router);

// Version 2 API routes
const v2Router = express.Router();

v2Router.get('/ping', (req, res) => {
  res.json({ status: 'ok', version: 'v2' });
});
app.use('/v2', v2Router);
// V2 Routes
app.use('/v2', v2AccountsRouter);
app.use('/v2', v2TransactionsRouter);

// OpenAPI spec endpoint
app.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
  console.log(`OpenAPI spec available at http://localhost:${PORT}/openapi.json`);
});
