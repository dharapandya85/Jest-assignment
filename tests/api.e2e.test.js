const { spawn } = require('child_process');
const path = require('path');

const {request, authHeader, uniqueUser, BASE_URL,} = require('./helpers/api');

const {
  connectToDatabase,
  getSeededFixtures,
  disconnectFromDatabase,
} = require('./helpers/db');

jest.setTimeout(30000);

describe('Salon API - Jest automation suite', () =>{
    let server;
    let fixtures;
    const dates = {
        e2e: '2030-01-15',
        authorization: '2030-01-16',
        duplicateSlot: '2030-01-17',
        cancelled: '2030-01-18',
    };
    async function waitForServer() {
        const deadline = Date.now() + 15000;
        let lastError;

        while(Date.now() < deadline) {
            try{
                const { response } = await request('/');
                if(response.ok) return;
            } catch(error) {
                lastError = error;
            }
            await new Promise((resolve) => setTimeout(resolve, 300));
        }
        throw new Error(`API server did not start: ${lastError?.message || 'unknown error'}`); 
    }
    async function registerUser(user = uniqueUser('customer')) {
        const result = await request('/api/register', {
            method: 'POST',
            body: JSON.stringify(user),
        });
        expect(result.response.status).toBe(201);
        expect(result.body).toEqual({message: 'User registered successfully'});
        return user;

    }
    async function loginUser(user) {
        const result = await request('/api/login', {
            method: 'POST',
            body: JSON.stringify({email: user.email, password: user.password }),
        });
        expect(result.response.status).toBe(200);
        expect(result.body.token).toEqual(expect.any(String));
        expect(result.body.role).toBe('customer');
        expect(result.body.userId).toEqual(expect.any(String));

        return result.body.token;

    }
    async function getAvailableSlot(date) {
        const path = `/api/salons/${fixtures.salonId}/available-slots?date=${date}&serviceId=${fixtures.serviceId}`;
        const result = await request(path);

        expect(result.response.status).toBe(200);
        expect(result.body.availableSlots.length).toBeGreaterThan(0);
        return result.body.availableSlots[0];

    }
    async function createBooking(token, date, slot) {
        const headers = token? authHeader(token) : {};

        console.log('createBooking token:', JSON.stringify(token));
        console.log('createBooking headers:', JSON.stringify(headers));

        return request('/api/bookings', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                salonId: fixtures.salonId,
                stylistId: slot.stylistId,
                serviceId: fixtures.serviceId,
                slotTime: slot.time,
                date,
            }),
        });
    }
    beforeAll(async () => {
        const projectRoot = path.resolve(__dirname, '..');
        server = spawn(process.execPath, [path.join(projectRoot, 'dist', 'index.js')], {
            cwd: projectRoot,
            env: {
                ...process.env,
                PORT: '3100',
            },
            stdio: 'pipe',
        });
        server.stdout.on('data', (data)=> process.stdout.write(`[api] ${data}`));
        server.stderr.on('data', (data)=> process.stderr.write(`[api] ${data}`));

        await waitForServer();
        await connectToDatabase();
        fixtures = await getSeededFixtures();
    });
    afterAll(async () => {
        await disconnectFromDatabase();
        if(server && !server.killed){
            server.kill('SIGTERM');
        }
    });
    test('GET / returns the API health response', async () => {
        const {response, body} = await request('/');

        expect(response.status).toBe(200);
        expect(body).toEqual({
            status: 'ok',
            message: 'Salon Backend is running!',
        });
    });

    test('register creates a customer successfully', async () => {
        await registerUser(uniqueUser('register-positive'))
    });

    test('register rejects an already registered email', async () => {
        const user = await registerUser(uniqueUser('register-duplicate'));

        const { response, body } = await request('/api/register', {
            method: 'POST',
            body: JSON.stringify(user),
        });

        expect(response.status).toBe(400);
        expect(body).toEqual({
            error: 'Email already in use'
        });
    });

    test('login returns a JWT for valid credentials', async () => {
        const user = await registerUser(uniqueUser('login-positive'))
        await loginUser(user);
    });

    test('login rejects invalid credentials', async () => {
        const user = await registerUser(uniqueUser('login-negative'));

        const { response, body } = await request('/api/login', {
            method: 'POST',
            body: JSON.stringify({
                email: user.email,
                password: 'WrongPassword!123'
            }),
        });

        expect(response.status).toBe(400);
        expect(body).toEqual({
            error: 'Invalid credentials'
        });
    });
    
    test('available slots returns slot for valid salon, date and service', async () => {
        const slot = await getAvailableSlot(dates.e2e);

        expect(slot).toEqual(
            expect.objectContaining({
                time: expect.stringMatching(/^\d{2}:\d{2}$/),
                stylistId: expect.any(String),
                stylistName: expect.any(String),
            })
        );
    });
    test('avaliable slots rejects missing required query parameters', async () =>{
        const { response, body} = await request(
            `/api/salons/${fixtures.salonId}/available-slots`
        );
        expect(response.status).toBe(400);
        expect(body).toEqual({error: 'date and serviceId are required'});
    });
    test('booking requires authentication', async()=>{
        const slot = await getAvailableSlot(dates.authorization);
        console.log('AUTH TEST TOKEN:', JSON.stringify(''));
        
        const {response, body}= await createBooking('', dates.authorization, slot);

        expect(response.status).toBe(401);
        expect(body).toEqual({error: 'Authentication required'});
    });

    test('booking rejects an invalid token', async()=>{
        const slot = await getAvailableSlot(dates.authorization);
        const {response, body} = await createBooking('invalid.jwt.token', dates.authorization, slot );

        expect(response.status).toBe(401);
        expect(body).toEqual({error: 'Invalid token'});
    })

    test('booking rejects an unknown service', async()=>{
        const user = await registerUser(uniqueUser('invalid-service'));
        const token = await loginUser(user);

        const {response, body } = await request('/api/bookings',{
            method: 'POST',
            headers: authHeader(token),
            body: JSON.stringify({
                salonId: fixtures.salonId,
                stylistId: fixtures.stylistId,
                serviceId: '000000000000000000000000',
                slotTime: '09:00',
                date: dates.authorization,
            }),
        });

        expect(response.status).toBe(404);
        expect(body).toEqual({error: 'Service not found'});
    });

    test('booking rejects a request without date', async()=>{
        const user = await registerUser(uniqueUser('missing-date'));
        const token = await loginUser(user);

        const {response, body} = await request('/api/bookings',{
            method: 'POST',
            headers: authHeader(token),
            body: JSON.stringify({
                salonId: fixtures.salonId,
                stylistId: fixtures.stylistId,
                serviceId: fixtures.serviceId,
                slotTime: '10:00',
            }),
        });

        expect(response.status).toBe(400);
        expect(body).toEqual({error: 'date is required'});
    });

    test('booking rejects a conflicting slot', async () => {
        const owner = await registerUser(uniqueUser('booking-owner'));
        const otherUser = await registerUser(uniqueUser('booking-other'));
        const ownerToken = await loginUser(owner);
        const otherToken = await loginUser(otherUser);
        const slot = await getAvailableSlot(dates.duplicateSlot);

        const firstBooking = await createBooking(ownerToken, dates.duplicateSlot, slot);
        expect(firstBooking.response.status).toBe(201);

        const conflictingBooking = await createBooking(otherToken, dates.duplicateSlot, slot);
        expect(conflictingBooking.response.status).toBe(400);
        expect(conflictingBooking.body).toEqual({ error: 'Time slot is no longer available'});

        const cancelResult = await request(
            `/api/bookings/${firstBooking.body.booking._id}/cancel`,
            {method: 'POST', headers: authHeader(ownerToken)}
        );
        expect(cancelResult.response.status).toBe(200);
        });

        test('E2E: Register -> Login -> Booking -> Cancel', async() =>{
        // Register
        const user = await registerUser(uniqueUser('full-e2e'));

        // Login
        const token= await loginUser(user);

        // Booking
        const slot = await getAvailableSlot(dates.e2e);
        const createResult = await createBooking(token, dates.e2e, slot);

        expect(createResult.response.status).toBe(201);
        expect(createResult.body.message).toBe('Booking created successfully');
        expect(createResult.body.booking).toEqual(
            expect.objectContaining({
                salonId: fixtures.salonId,
                stylistId: slot.stylistId,
                serviceId: fixtures.serviceId,
                date: dates.e2e,
                startTime: slot.time,
                status: 'booked',
            })
        );
        expect(createResult.body.booking.endTime).toEqual(expect.stringMatching(/^\d{2}:\d{2}$/));

        // Cancel
        const bookingId = createResult.body.booking._id;
        const cancelResult = await request(`/api/bookings/${bookingId}/cancel`, {
            method: 'POST',
            headers: authHeader(token),
        });
        
        expect(cancelResult.response.status).toBe(200);
        expect(cancelResult.body).toEqual({
            message: 'Booking cancelled successfully'
        });
    });

     test('authorization prevents another customer from cancelling the booking', async () => {
        const owner = await registerUser(uniqueUser('authorization-owner'));
        const otherUser = await registerUser(uniqueUser('authorization-other'));
        const ownerToken = await loginUser(owner);
        const otherToken = await loginUser(otherUser);
        const slot = await getAvailableSlot(dates.authorization);

        const createResult = await createBooking(ownerToken, dates.authorization, slot);
        expect(createResult.response.status).toBe(201);

        const bookingId = createResult.body.booking._id;
        const unauthorizedCancel = await request(`/api/bookings/${bookingId}/cancel`,{
            method: 'POST',
            headers: authHeader(otherToken),
        });

        expect(unauthorizedCancel.response.status).toBe(403);
        expect(unauthorizedCancel.body).toEqual({
            error: 'Not authorized to cancel this booking',
        });

        const ownerCancel = await request(
            `/api/bookings/${bookingId}/cancel`,
            {method: 'POST', 
            headers: authHeader(ownerToken)}
        );
        expect(ownerCancel.response.status).toBe(200);
        });

    test('cancelling an already cancelled booking is rejected', async () => {
        const user = await registerUser(uniqueUser('cancelled-booking'));
        const token = await loginUser(user);
        const slot = await getAvailableSlot(dates.cancelled);

        const createResult = await createBooking(token, dates.cancelled, slot);
        expect(createResult.response.status).toBe(201);

        const bookingId = await createResult.body.booking._id;
        const firstCancel = await request(`/api/bookings/${bookingId}/cancel`, {
            method: 'POST',
            headers: authHeader(token),
        });
        expect(firstCancel.response.status).toBe(200);

        const secondCancel = await request(`/api/bookings/${bookingId}/cancel`, {
            method: 'POST',
            headers: authHeader(token),
        });
        //expect(firstCancel.response.status).toBe(200);

        expect(secondCancel.response.status).toBe(400);
        expect(secondCancel.body).toEqual({
            error: 'Booking is already cancelled'
        });
    });

    test('cancelling a nonexistent booking returns 404', async () => {
        const user = await registerUser(uniqueUser('missing-booking'));
        const token = await loginUser(user);

        const { response, body } = await request(
            '/api/bookings/000000000000000000000000/cancel', 
        {
            method: 'POST',
            headers: authHeader(token),
        }
    );

        expect(response.status).toBe(404);
        expect(body).toEqual({
            error: 'Booking not found'
        });
    });
});