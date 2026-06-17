
// Helper function for authenticated API calls
window.apiFetch = async function(url, options = {}) {
    if (window.Clerk && window.Clerk.session) {
        try {
            const token = await window.Clerk.session.getToken();
            if (token) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                };
            }
        } catch(e) {
            console.warn('Failed to get Clerk token', e);
        }
    }
    return fetch(url, options);
};

document.addEventListener('DOMContentLoaded', () => {
    let mockLessons = [];

    let ITEMS_PER_PAGE = 5;

    let currentPage = 1;
    let currentTab = 'upcoming'; // 'upcoming' or 'past'

    const gridContainer = document.getElementById('lessonGrid');
    const paginationContainer = document.getElementById('paginationControls');
    const tabBtns = document.querySelectorAll('.dashboard-tabs .tab-btn');

    // Fetch lessons from API or LocalStorage Fallback
    async function fetchLessons() {
        if (!window.Clerk || !window.Clerk.user) {
            // Give clerk a moment to load
            setTimeout(fetchLessons, 500);
            return;
        }

        const user = window.Clerk.user;

        try {
            const res = await window.apiFetch(`api/bookings.php?user_id=${user.id}`);
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
                if (data.status === 'success') {
                    mockLessons = data.data.map(b => ({
                        id: b.id,
                        title: b.plan_name,
                        coach: b.coach_name,
                        date: new Date(b.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        rawDate: b.booking_date,
                        time: b.booking_time,
                        location: b.plan_name.includes('Outside') ? 'Outside Ikoyi Club' : 'Ikoyi Golf Club, Ikoyi, Lagos',
                        status: b.status
                    }));
                }
            } catch (e) {
                // Fallback for local testing via npx serve
                console.warn("PHP API not reachable, falling back to localStorage.");
                const localBookings = JSON.parse(localStorage.getItem('smj_local_bookings') || '[]');
                const userBookings = localBookings.filter(b => b.user_id === user.id);

                mockLessons = userBookings.map(b => ({
                    id: b.id,
                    title: b.plan_name,
                    coach: b.coach_name,
                    date: new Date(b.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    rawDate: b.booking_date,
                    time: b.booking_time,
                    location: b.plan_name.includes('Outside') ? 'Outside Ikoyi Club' : 'Ikoyi Golf Club, Ikoyi, Lagos',
                    status: b.status
                }));
            }
        } catch (err) {
            console.error("Failed to fetch lessons:", err);
        }

        renderLessons();
    }

    function renderLessons() {
        // Filter by tab
        const filteredLessons = mockLessons.filter(lesson => {
            if (currentTab === 'upcoming') {
                return lesson.status === 'upcoming';
            } else {
                return lesson.status === 'completed' || lesson.status === 'cancelled';
            }
        });

        // Calculate pagination
        const totalPages = Math.ceil(filteredLessons.length / ITEMS_PER_PAGE);
        if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageLessons = filteredLessons.slice(startIndex, endIndex);

        // Render HTML
        gridContainer.innerHTML = '';

        if (pageLessons.length === 0) {
            gridContainer.innerHTML = `
                <div class="lesson-card empty-state" style="padding: 0; text-align: center; display: flex; flex-direction: column; max-width: 400px; grid-column: 1 / -1; margin: 0 auto; width: 100%;">
                    <div style="padding: 1.5rem; flex: 1;">
                        <h3 style="text-transform: uppercase; margin-bottom: 0.25rem; font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em;">NO ${currentTab.toUpperCase()} LESSONS FOUND.</h3>
                        <p style="color: var(--text-dark); margin-bottom: 0; font-size: 1rem;">Ready to improve your game?</p>
                    </div>
                    <button class="book-btn" style="width: 100%; background: var(--accent); color: var(--text-dark); border: none; border-top: 4px solid var(--text-dark); padding: 1rem; font-weight: 700; text-transform: uppercase; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.background='var(--text-dark)'; this.style.color='#fff';" onmouseout="this.style.background='var(--accent)'; this.style.color='var(--text-dark)';">BOOK A LESSON</button>
                </div>
            `;
        } else {
            const getDurationForPlan = (title) => {
                const t = title.toUpperCase();
                if (t.includes('18 HOLES')) return '4 Hours';
                if (t.includes('9 HOLES')) return '2 Hours';
                if (t.includes('MONTHLY') || t.includes('KIDS')) return '1 Hour / Session';
                return '1 Hour';
            };

            pageLessons.forEach(lesson => {
                const isUpcoming = lesson.status === 'upcoming';
                const statusClass = isUpcoming ? 'status-upcoming' : (lesson.status === 'cancelled' ? 'status-cancelled' : 'status-past');
                const statusText = lesson.status.toUpperCase();
                
                let isWithinOneHour = false;
                if (isUpcoming && lesson.rawDate && lesson.time) {
                    const [year, month, day] = lesson.rawDate.split('-');
                    const [timeStr, modifier] = lesson.time.split(' ');
                    let [hours, minutes] = timeStr.split(':');
                    hours = parseInt(hours, 10);
                    if (modifier === 'PM' && hours < 12) hours += 12;
                    if (modifier === 'AM' && hours === 12) hours = 0;
                    
                    const bookingDateTime = new Date(year, month - 1, day, hours, parseInt(minutes, 10));
                    const now = new Date();
                    const diffMs = bookingDateTime - now;
                    // 1 hour = 3600000 ms
                    if (diffMs <= 3600000) {
                        isWithinOneHour = true;
                    }
                }
                
                let actionBtn = `<button class="btn btn-outline btn-sm">Review Notes</button>`;
                
                if (isUpcoming) {
                    if (isWithinOneHour) {
                        actionBtn = `<div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-outline btn-sm disabled" style="opacity:0.6; cursor:not-allowed;" title="Cannot modify within 1 hour of appointment">Locked (Within 1 hour)</button>
                        </div>`;
                    } else {
                        actionBtn = `<div style="display: flex; gap: 0.5rem;"><button class="btn btn-outline btn-sm reschedule-btn" data-id="${lesson.id}" data-title="${lesson.title}" data-coach="${lesson.coach}">Reschedule</button>
                           <button class="btn btn-outline btn-sm cancel-btn" data-id="${lesson.id}" style="border-color: #ef4444; color: #ef4444;" onmouseover="this.style.background='#ef4444'; this.style.color='#fff';" onmouseout="this.style.background='transparent'; this.style.color='#ef4444';">Cancel</button></div>`;
                    }
                }

                gridContainer.innerHTML += `
                    <div class="lesson-card">
                        <div class="lesson-card-header">
                            <span class="lesson-status ${statusClass}">${statusText}</span>
                            <div class="lesson-date">${lesson.date} &nbsp;&bull;&nbsp; ${lesson.time}</div>
                        </div>
                        <div class="lesson-card-body">
                            <h3>${lesson.title}</h3>
                            <div class="lesson-detail">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                Coach: ${lesson.coach}
                            </div>
                            <div class="lesson-detail">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                ${lesson.location}
                            </div>
                            <div class="lesson-detail">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                Duration: ${getDurationForPlan(lesson.title)}
                            </div>
                        </div>
                        <div class="lesson-card-footer">
                            ${actionBtn}
                        </div>
                    </div>
                `;
            });
        }

        renderPagination(totalPages);

        // Re-attach event listeners
        const dynamicBookBtn = gridContainer.querySelector('.empty-state .book-btn');
        if (dynamicBookBtn) {
            dynamicBookBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.smjRescheduleMode = null; // Ensure not in reschedule mode
                const bookingModal = document.getElementById('bookingModal');
                if (bookingModal) bookingModal.classList.add('active');
            });
        }

        // Reschedule listeners
        const rescheduleBtns = gridContainer.querySelectorAll('.reschedule-btn');
        rescheduleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                const title = btn.dataset.title;
                const coach = btn.dataset.coach;

                // Set global state for reschedule mode
                window.smjRescheduleMode = { id, title, coach };

                const bookingModal = document.getElementById('bookingModal');
                if (bookingModal) {
                    bookingModal.classList.add('active');

                    // Hide step 1 and show step 3 directly
                    const step1 = document.getElementById('step1');
                    if (step1) step1.style.display = 'none';

                    const step3Booking = document.getElementById('step3-booking');
                    if (step3Booking) {
                        step3Booking.style.display = 'block';
                        document.querySelector('.modal-content').classList.add('modal-regular-wide');

                        // Populate details
                        const titleEl = document.getElementById('bookingPlanTitle');
                        if (titleEl) titleEl.textContent = title + " (Reschedule)";

                        // Call initCalendar if available
                        if (typeof window.initCalendar === 'function') {
                            window.initCalendar();
                        }
                    }
                }
            });
        });

        // Cancel listeners
        const cancelBtns = gridContainer.querySelectorAll('.cancel-btn');
        cancelBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();

                // Inject custom cancel modal if it doesn't exist
                let cancelModal = document.getElementById('cancelModalOverlay');
                if (!cancelModal) {
                    cancelModal = document.createElement('div');
                    cancelModal.id = 'cancelModalOverlay';
                    cancelModal.className = 'logout-modal-overlay'; // Reusing styles from logout modal
                    cancelModal.innerHTML = `
                        <div class="logout-modal" style="border: 4px solid var(--text-dark); box-shadow: 12px 12px 0 var(--text-dark);">
                            <h3>Cancel Lesson?</h3>
                            <p>Are you sure you want to cancel this lesson? This action cannot be undone.</p>
                            <div class="logout-modal-actions">
                                <button class="btn btn-outline" id="cancelModalNoBtn" style="border-radius: 0;">No, Keep It</button>
                                <button class="btn btn-danger" id="cancelModalYesBtn" style="border-radius: 0;">Yes, Cancel</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(cancelModal);
                }

                cancelModal.classList.add('show');

                // Handle No
                const noBtn = document.getElementById('cancelModalNoBtn');
                noBtn.onclick = () => {
                    cancelModal.classList.remove('show');
                };

                // Handle Yes
                const yesBtn = document.getElementById('cancelModalYesBtn');
                yesBtn.onclick = async () => {
                    cancelModal.classList.remove('show');

                    const id = btn.dataset.id;
                    btn.textContent = '...';
                    btn.disabled = true;

                    try {
                        const res = await window.apiFetch('api/bookings.php', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: id, status: 'cancelled' })
                        });

                        const text = await res.text();
                        try {
                            const data = JSON.parse(text);
                            if (data.status === 'success') {
                                window.showToaster("Lesson cancelled successfully.");
                            } else {
                                window.showToaster("Failed to cancel lesson.", true);
                            }
                        } catch (err) {
                            // Local storage fallback
                            let localBookings = JSON.parse(localStorage.getItem('smj_local_bookings') || '[]');
                            const index = localBookings.findIndex(b => String(b.id) === String(id));
                            if (index > -1) {
                                localBookings[index].status = 'cancelled';
                                localStorage.setItem('smj_local_bookings', JSON.stringify(localBookings));
                            }
                            window.showToaster("Lesson cancelled.");
                        }
                    } catch (err) {
                        console.error(err);
                        window.showToaster("Network error occurred.", true);
                    }

                    // Refresh list
                    fetchLessons();
                };
            });
        });
    }

    function renderPagination(totalPages) {
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let html = '';
        html += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}">PREV</button>`;

        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-btn ${currentPage === i ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}">NEXT</button>`;

        paginationContainer.innerHTML = html;

        // Attach events
        const pageBtns = paginationContainer.querySelectorAll('.page-btn:not(.disabled)');
        pageBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentPage = parseInt(e.target.dataset.page);
                renderLessons();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    // Tab switching logic
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active from all
            tabBtns.forEach(b => b.classList.remove('active'));
            // Add to clicked
            e.target.classList.add('active');

            // Set current tab based on button text
            currentTab = e.target.textContent.toLowerCase().trim();
            currentPage = 1; // Reset to page 1 on tab switch

            renderLessons();
        });
    });

    // We wait for window load so Clerk is initialized before fetching
    window.addEventListener('load', () => {
        fetchLessons();
    });
});
