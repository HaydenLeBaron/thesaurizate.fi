import '../init';
import express from 'express';
import transactionsRouter from '../routes/transactions';
import accountsRouter from '../routes/accounts';
import usersRouter from '../routes/users';

export const app = express();

app.use(express.json());

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
