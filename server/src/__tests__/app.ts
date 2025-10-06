import '../init';
import express from 'express';
import transactionsRouter from '../routes/transactions';
import usersRouter from '../routes/users';

export const app = express();

app.use(express.json());
app.use('/', transactionsRouter);
app.use('/', usersRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
