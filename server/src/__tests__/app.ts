import '../init';
import express from 'express';
import transactionsRouter from '../routes/transactions';
import accountsRouter from '../routes/accounts';
import usersRouter from '../routes/users';

export const app = express();

app.use(express.json());
app.use('/', transactionsRouter);
app.use('/', accountsRouter);
app.use('/', usersRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
