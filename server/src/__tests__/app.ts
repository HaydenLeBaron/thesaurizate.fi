import '../init';
import express from 'express';
import transactionsRouter from '../routes/transactions';
import usersRouter from '../routes/users';
import authRouter from '../routes/auth';
import plaidRouter from '../routes/plaid';
import wellKnownRouter from '../routes/well-known';

export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For OAuth form-encoded requests

// Public endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/', transactionsRouter);
app.use('/', usersRouter);
app.use('/oauth', authRouter);
app.use('/.well-known', wellKnownRouter);
app.use('/', plaidRouter);
