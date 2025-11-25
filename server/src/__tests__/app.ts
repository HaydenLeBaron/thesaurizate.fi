import '../init';
import express from 'express';
import transactionsRouter from '../routes/transactions';
import accountsRouter from '../routes/accounts';
import usersRouter from '../routes/users';
import v2AccountsRouter from '../routes/v2/accounts';
import v2TransactionsRouter from '../routes/v2/transactions';

export const app = express();

app.use(express.json());
app.use('/', transactionsRouter);
app.use('/', accountsRouter);
app.use('/', usersRouter);
app.use('/v2', v2AccountsRouter);
app.use('/v2', v2TransactionsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
