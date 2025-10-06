// IMPORTANT: Must be imported first to extend Zod globally
import './init';

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import transactionsRouter from './routes/transactions';
import usersRouter from './routes/users';
import { openApiSpec } from './openapi';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Routes
app.use('/', transactionsRouter);
app.use('/', usersRouter);

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
