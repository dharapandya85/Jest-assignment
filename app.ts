import express from 'express';
import  cors from 'cors';

import authRoutes from './routes/authRoutes';
import salonRoutes from './routes/salonRoutes';
import bookingRoutes from './routes/bookingRoutes';

const app = express();

app.use(express.json());
app.use(cors());

app.get('/', (_req, res) => {
    res.json({status: 'ok', message: 'Salon Backend is running!'});
});

app.use('/api', authRoutes);
app.use('/api', salonRoutes);
app.use('/api', bookingRoutes);

export default app;