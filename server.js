const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const DB_FILE = path.join(__dirname, 'api_data.json');

// Initial default database
const INITIAL_DATA = {
    settings: {
        schedule_start: "09:00",
        schedule_end: "16:00",
        buffer_before: "10",
        buffer_after: "10",
        cancellation_window_hours: "1",
        email_automations: "true",
        admin_email: "balogunsmj@gmail.com",
        coach_email: "balogunsmj@gmail.com",
        paystack_status: "disabled",
        paystack_public_key: "pk_test_sample"
    },
    plans: [
        { id: 1, title: "1 Hour Range Lesson", category: "onetime", price: 25000, duration: "60 Minutes", is_premium: true, features: ["Full swing, chipping, and putting mechanics", "TrackMan radar & high-speed video feedback", "Personalized swing correction drill plan", "Range balls included"] },
        { id: 2, title: "9 Holes Playing Lesson", category: "onetime", price: 60000, duration: "2.5 Hours", is_premium: false, features: ["Real course management & shot selection", "Awkward lies, hazards, & trouble recovery", "Green reading and putting strategy", "Live tactical and psychological coaching"] },
        { id: 3, title: "18 Holes Playing Lesson", category: "onetime", price: 110000, duration: "5 Hours", is_premium: true, features: ["Comprehensive 18-hole tournament strategy", "Full stats analysis & strokes gained breakdown", "In-round nutrition & mental focus coaching", "Detailed post-round review and drill routine"] },
        { id: 4, title: "Simulator & TrackMan Analysis", category: "onetime", price: 35000, duration: "90 Minutes", is_premium: false, features: ["Launch angle, spin rate, & club path telemetry", "High-speed video clubhead delivery review", "Equipment & shaft optimization advice"] },
        { id: 5, title: "Outside Ikoyi Club Lesson", category: "onetime", price: 150000, duration: "Full Day", is_premium: true, features: ["Full day coaching at any preferred course", "Intensive swing and course management training", "Personalized long-term development roadmap"] },
        { id: 6, title: "Newbie 10-Session Foundation", category: "newbie", price: 200000, duration: "10 Sessions (60 mins each)", is_premium: true, features: ["Grip, posture, and core swing mechanics", "Short game: Chipping, pitching, and bunker play", "Putting stroke calibration and distance control", "Golf rules, course etiquette, and readiness test"] },
        { id: 7, title: "Newbie 5-Session Quickstart", category: "newbie", price: 110000, duration: "5 Sessions (60 mins each)", is_premium: false, features: ["Essential swing fundamentals & setup", "Solid ball striking & contact drills", "Basic chipping and putting instruction"] },
        { id: 8, title: "Monthly Performance Plan", category: "monthly", price: 180000, duration: "4 Weeks / 8 Sessions", is_premium: true, features: ["2 private coaching sessions per week", "Priority calendar reservation access", "Continuous TrackMan swing analytics", "Weekly tailored homework practice drills"] },
        { id: 9, title: "Kids Monthly Academy", category: "monthly", price: 130000, duration: "4 Weeks / 6 Sessions", is_premium: true, features: ["Fun, engaging junior golfing fundamentals", "Hand-eye coordination and balance games", "Junior equipment provided during sessions", "End-of-month skills assessment certificate"] },
        { id: 10, title: "Junior Individual Session", category: "kids", price: 20000, duration: "45 Minutes", is_premium: false, features: ["Age-appropriate swing basics", "Putting challenge games & fun drills", "Friendly coaching tailored for kids"] },
        { id: 11, title: "Kids 5-Session Package", category: "kids", price: 90000, duration: "5 Sessions (45 mins each)", is_premium: true, features: ["Complete junior fundamentals introduction", "Chipping, putting, and full swing games", "Junior golf rules and safety basics"] },
        { id: 12, title: "Range & Swing Mechanics", category: "newbie_session", price: 0, duration: "60 Minutes", is_premium: false, features: [] },
        { id: 13, title: "Putting & Chipping Drill", category: "newbie_session", price: 0, duration: "60 Minutes", is_premium: false, features: [] },
        { id: 14, title: "9 Holes Course Practice", category: "newbie_session", price: 0, duration: "2.5 Hours", is_premium: false, features: [] },
        { id: 15, title: "Junior Range Session", category: "kids_session", price: 0, duration: "45 Minutes", is_premium: false, features: [] },
        { id: 16, title: "Junior Short Game Drill", category: "kids_session", price: 0, duration: "45 Minutes", is_premium: false, features: [] },
        { id: 17, title: "Swing Video Analysis", category: "advanced_session", price: 0, duration: "60 Minutes", is_premium: false, features: [] },
        { id: 18, title: "9 Holes Strategic Play", category: "advanced_session", price: 0, duration: "2.5 Hours", is_premium: false, features: [] },
        { id: 19, title: "Short Game Mastery", category: "advanced_session", price: 0, duration: "60 Minutes", is_premium: false, features: [] }
    ],
    bookings: [
        {
            id: 1,
            user_id: "user_demo_1",
            user_name: "Adewale Johnson",
            plan_name: "1 Hour Range Lesson",
            coach_name: "Balogun Jacob Micheal",
            booking_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
            booking_time: "10:00 AM",
            status: "upcoming",
            payment_status: "paid",
            payment_method: "cash",
            amount: 25000,
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            user_id: "user_demo_2",
            user_name: "Chioma Okonkwo",
            plan_name: "9 Holes Playing Lesson",
            coach_name: "Balogun Jacob Micheal",
            booking_date: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
            booking_time: "02:00 PM",
            status: "upcoming",
            payment_status: "paid",
            payment_method: "cash",
            amount: 60000,
            created_at: new Date().toISOString()
        },
        {
            id: 3,
            user_id: "user_demo_3",
            user_name: "Tunde Bakare",
            plan_name: "1 Hour Range Lesson",
            coach_name: "Balogun Jacob Micheal",
            booking_date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
            booking_time: "11:30 AM",
            status: "completed",
            payment_status: "paid",
            payment_method: "cash",
            amount: 25000,
            created_at: new Date(Date.now() - 86400000 * 4).toISOString()
        }
    ],
    clients: [
        {
            user_id: "user_demo_1",
            name: "Adewale Johnson",
            email: "adewale.j@example.com",
            total_bookings: 3,
            last_active: new Date().toISOString(),
            joined_at: new Date(Date.now() - 86400000 * 30).toISOString()
        },
        {
            user_id: "user_demo_2",
            name: "Chioma Okonkwo",
            email: "chioma.o@example.com",
            total_bookings: 2,
            last_active: new Date().toISOString(),
            joined_at: new Date(Date.now() - 86400000 * 15).toISOString()
        },
        {
            user_id: "user_demo_3",
            name: "Tunde Bakare",
            email: "tunde.b@example.com",
            total_bookings: 1,
            last_active: new Date(Date.now() - 86400000 * 3).toISOString(),
            joined_at: new Date(Date.now() - 86400000 * 10).toISOString()
        }
    ]
};

function loadDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (err) {
        console.warn('Could not read db file, initializing new one:', err.message);
    }
    saveDatabase(INITIAL_DATA);
    return INITIAL_DATA;
}

function saveDatabase(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Error saving db:', err);
    }
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, data) {
    setCors(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
    });
}

const requestHandler = async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    const query = parsedUrl.query;
    const method = req.method.toUpperCase();

    // ================= API ENDPOINTS =================
    if (pathname.startsWith('/api/')) {
        const db = loadDatabase();
        const endpoint = pathname.replace('/api/', '');

        // 1. Settings
        if (endpoint === 'settings.php' || endpoint === 'settings') {
            if (method === 'GET') {
                return sendJson(res, 200, { status: 'success', data: db.settings });
            }
            if (method === 'POST') {
                const body = await parseBody(req);
                db.settings = { ...db.settings, ...body };
                saveDatabase(db);
                return sendJson(res, 200, { status: 'success', message: 'Settings updated successfully' });
            }
        }

        // 2. Plans
        if (endpoint === 'plans.php' || endpoint === 'plans') {
            if (method === 'GET') {
                return sendJson(res, 200, { status: 'success', data: db.plans });
            }
            if (method === 'POST') {
                const body = await parseBody(req);
                const newId = (db.plans.length > 0 ? Math.max(...db.plans.map(p => p.id)) : 0) + 1;
                const newPlan = { ...body, id: newId };
                db.plans.push(newPlan);
                saveDatabase(db);
                return sendJson(res, 200, { status: 'success', message: 'Plan added successfully', id: newId });
            }
            if (method === 'PUT') {
                const body = await parseBody(req);
                const idx = db.plans.findIndex(p => String(p.id) === String(body.id));
                if (idx !== -1) {
                    db.plans[idx] = { ...db.plans[idx], ...body };
                    saveDatabase(db);
                    return sendJson(res, 200, { status: 'success', message: 'Plan updated successfully' });
                }
                return sendJson(res, 404, { status: 'error', message: 'Plan not found' });
            }
            if (method === 'DELETE') {
                const body = await parseBody(req);
                const targetId = body.id || query.id;
                db.plans = db.plans.filter(p => String(p.id) !== String(targetId));
                saveDatabase(db);
                return sendJson(res, 200, { status: 'success', message: 'Plan deleted successfully' });
            }
        }

        // 3. Bookings
        if (endpoint === 'bookings.php' || endpoint === 'bookings') {
            if (method === 'GET') {
                let list = db.bookings;
                if (query.user_id) {
                    list = list.filter(b => b.user_id === query.user_id);
                }
                return sendJson(res, 200, { status: 'success', data: list });
            }
            if (method === 'POST') {
                const body = await parseBody(req);
                const newId = (db.bookings.length > 0 ? Math.max(...db.bookings.map(b => b.id)) : 0) + 1;
                const newBooking = {
                    id: newId,
                    user_id: body.user_id || "guest_user",
                    user_name: body.user_name || "Guest Golfer",
                    plan_name: body.plan_name || "1 Hour Range Lesson",
                    coach_name: body.coach_name || "Balogun Jacob Micheal",
                    booking_date: body.booking_date,
                    booking_time: body.booking_time,
                    status: body.status || "upcoming",
                    payment_status: body.payment_status || "paid",
                    payment_method: body.payment_method || "cash",
                    amount: body.amount || 25000,
                    created_at: new Date().toISOString()
                };
                db.bookings.push(newBooking);
                
                // Track in clients if not present
                const clientIdx = db.clients.findIndex(c => c.user_id === newBooking.user_id);
                if (clientIdx !== -1) {
                    db.clients[clientIdx].total_bookings = (db.clients[clientIdx].total_bookings || 0) + 1;
                    db.clients[clientIdx].last_active = new Date().toISOString();
                } else {
                    db.clients.push({
                        user_id: newBooking.user_id,
                        name: newBooking.user_name,
                        email: body.user_email || `${newBooking.user_name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
                        total_bookings: 1,
                        last_active: new Date().toISOString(),
                        joined_at: new Date().toISOString()
                    });
                }

                saveDatabase(db);
                const coachEmail = db.settings.coach_email || db.settings.admin_email || 'balogun@smjgyhd.com.ng';
                console.log(`[Email Dispatcher] [OK] Alert sent to Coach Balogun Jacob Micheal (${coachEmail}) for appointment #${newId} - ${newBooking.plan_name} on ${newBooking.booking_date} at ${newBooking.booking_time}`);
                return sendJson(res, 200, { status: 'success', message: 'Booking confirmed successfully', id: newId });
            }
            if (method === 'PUT') {
                const body = await parseBody(req);
                const idx = db.bookings.findIndex(b => String(b.id) === String(body.id));
                if (idx !== -1) {
                    db.bookings[idx] = { ...db.bookings[idx], ...body };
                    saveDatabase(db);
                    return sendJson(res, 200, { status: 'success', message: 'Booking updated successfully' });
                }
                return sendJson(res, 404, { status: 'error', message: 'Booking not found' });
            }
        }

        // 4. Clients
        if (endpoint === 'clients.php' || endpoint === 'clients') {
            if (method === 'GET') {
                return sendJson(res, 200, { status: 'success', data: db.clients });
            }
            if (method === 'DELETE') {
                const body = await parseBody(req);
                const userId = body.user_id || query.user_id;
                db.clients = db.clients.filter(c => c.user_id !== userId);
                db.bookings = db.bookings.filter(b => b.user_id !== userId);
                saveDatabase(db);
                return sendJson(res, 200, { status: 'success', message: 'User data deleted successfully.' });
            }
        }

        // 5. Users
        if (endpoint === 'users.php' || endpoint === 'users') {
            const userList = db.clients.map(c => ({ id: c.user_id, name: c.name, email: c.email }));
            return sendJson(res, 200, { status: 'success', data: userList });
        }

        // 6. User Limits
        if (endpoint === 'user_limits.php' || endpoint === 'user_limits') {
            return sendJson(res, 200, { status: 'success', data: {} });
        }

        return sendJson(res, 404, { status: 'error', message: 'Endpoint not found' });
    }

    // ================= STATIC FILES =================
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    }

    let filePath = path.join(PUBLIC_DIR, decodeURIComponent(pathname));

    // Security check: prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Try appending .html
            if (fs.existsSync(filePath + '.html')) {
                filePath = filePath + '.html';
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 Not Found');
                return;
            }
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
};

function createAndStartServer(port) {
    const srv = http.createServer(requestHandler);
    srv.listen(port, () => {
        console.log(`\n======================================================`);
        console.log(`  ⛳ SMJ Golf Academy App is running!`);
        console.log(`  🔗 Open in browser: http://localhost:${port}`);
        console.log(`  📁 Serving from: ${PUBLIC_DIR}`);
        console.log(`======================================================\n`);
    });
    srv.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} in use, trying port ${port + 1}...`);
            createAndStartServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });
}

createAndStartServer(PORT);


