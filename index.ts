// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);
// import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
// import cors from 'cors';
import app from './app';
// import authRoutes from './routes/authRoutes';
// import salonRoutes from './routes/salonRoutes';
// import bookingRoutes from './routes/bookingRoutes';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/salon-db';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  // .catch((error) => {
  //   console.error('MongoDB connection error:', error);
  //   process.exit(1);
  // });
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });
