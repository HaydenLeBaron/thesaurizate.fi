// IMPORTANT: Must be imported first to extend Zod globally
import './init';

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import transactionsRouter from './routes/transactions';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import plaidRouter from './routes/plaid';
import wellKnownRouter from './routes/well-known';
import { openApiSpec } from './openapi';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For OAuth form-encoded requests

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Public endpoints (no authentication required)
app.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/', transactionsRouter);
app.use('/', usersRouter);
app.use('/oauth', authRouter);
app.use('/.well-known', wellKnownRouter);
app.use('/', plaidRouter); // Plaid routes are already prefixed with /accounts

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
  console.log(`OpenAPI spec available at http://localhost:${PORT}/openapi.json`);
});
