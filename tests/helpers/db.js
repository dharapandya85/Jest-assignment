const mongoose = require('mongoose');

async function connectToDatabase() {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/salon-db';
    await mongoose.connect(uri);
    return mongoose.connection;
}

async function getSeededFixtures() {
    const db = mongoose.connection.db;

    const salon = await db.collection('salons').findOne({ name: 'Elegant Beauty Salon' });
    const service = await db.collection('services').findOne({ name: 'Men Haircut' });
    const stylist = await db.collection('users').findOne({ role: 'stylist' });

    if(!salon || !service || !stylist){
        throw new Error(
            'Required seeded data is missing. Run `npm run seed` before running the Jest suite.'
        );
    }
    return {
        salonId: salon._id.toString(),
        serviceId: service._id.toString(),
        stylistId: stylist._id.toString(),
    };
}
async function disconnectFromDatabase() {
    await mongoose.disconnect();
}

module.exports = { connectToDatabase, getSeededFixtures, disconnectFromDatabase };