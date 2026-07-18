
// Helper function for authenticated API calls
window.apiFetch = async function (url, options = {}) {
    if (window.Clerk && window.Clerk.session) {
        try {
            const token = await window.Clerk.session.getToken();
            if (token) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                };
            }
        } catch (e) {
            console.warn('Failed to get Clerk token', e);
        }
    }
    return fetch(url, options);
};

let GLOBAL_SCHEDULE_START = 9 * 60;
let GLOBAL_SCHEDULE_END = 16 * 60;
let GLOBAL_BUFFER_BEFORE = 10;
let GLOBAL_BUFFER_AFTER = 10;
let GLOBAL_STANDARD_SLOTS = [9 * 60, 9 * 60 + 30, 10 * 60, 10 * 60 + 30, 11 * 60, 11 * 60 + 30, 12 * 60, 12 * 60 + 30, 13 * 60, 13 * 60 + 30, 14 * 60, 14 * 60 + 30, 15 * 60, 15 * 60 + 30, 16 * 60];

document.addEventListener('DOMContentLoaded', async () => {
    // Load Global Schedule Settings
    try {
        const res = await window.apiFetch('api/settings.php');
        const text = await res.text();
        const data = JSON.parse(text);
        if (data.status === 'success' && data.data) {
            if (data.data.schedule_start) {
                const [h, m] = data.data.schedule_start.split(':').map(Number);
                GLOBAL_SCHEDULE_START = h * 60 + m;
            }
            if (data.data.schedule_end) {
                const [h, m] = data.data.schedule_end.split(':').map(Number);
                GLOBAL_SCHEDULE_END = h * 60 + m;
            }
            if (data.data.buffer_before !== undefined) {
                GLOBAL_BUFFER_BEFORE = parseInt(data.data.buffer_before, 10);
            }
            if (data.data.buffer_after !== undefined) {
                GLOBAL_BUFFER_AFTER = parseInt(data.data.buffer_after, 10);
            }
            GLOBAL_STANDARD_SLOTS = [];
            for (let curr = GLOBAL_SCHEDULE_START; curr <= GLOBAL_SCHEDULE_END; curr += 30) {
                GLOBAL_STANDARD_SLOTS.push(curr);
            }
        }
    } catch (e) {
        console.warn('Failed to load global schedule settings', e);
    }

    document.getElementById('adminDateDisplay').textContent = new Date().toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    let allBookings = [];
    let searchQuery = '';
    let statusFilter = 'all';

    // Calendar View State
    let currentAdminView = 'calendar'; // 'table' or 'calendar'
    let currentCalendarDate = new Date();

    // Toggle logic
    const viewToggleTable = document.getElementById('viewToggleTable');
    const viewToggleCalendar = document.getElementById('viewToggleCalendar');
    const tableViewContainer = document.getElementById('tableViewContainer');
    const calendarViewContainer = document.getElementById('calendarViewContainer');
    const adminFilters = document.querySelector('.admin-filters');

    if (viewToggleTable && viewToggleCalendar) {
        viewToggleTable.addEventListener('click', () => {
            currentAdminView = 'table';
            viewToggleTable.classList.add('active');
            viewToggleCalendar.classList.remove('active');
            if (tableViewContainer) tableViewContainer.style.display = 'block';
            if (calendarViewContainer) calendarViewContainer.style.display = 'none';
            if (adminFilters) adminFilters.style.display = 'flex';
            renderAdminDashboard();
        });
        viewToggleCalendar.addEventListener('click', () => {
            currentAdminView = 'calendar';
            viewToggleCalendar.classList.add('active');
            viewToggleTable.classList.remove('active');
            if (tableViewContainer) tableViewContainer.style.display = 'none';
            if (calendarViewContainer) calendarViewContainer.style.display = 'block';
            if (adminFilters) adminFilters.style.display = 'none';
            renderAdminDashboard();
        });
    }

    const calPrevDay = document.getElementById('calPrevDay');
    const calNextDay = document.getElementById('calNextDay');
    if (calPrevDay) {
        calPrevDay.addEventListener('click', () => {
            currentCalendarDate.setDate(currentCalendarDate.getDate() - 1);
            renderAdminDashboard();
        });
    }
    if (calNextDay) {
        calNextDay.addEventListener('click', () => {
            currentCalendarDate.setDate(currentCalendarDate.getDate() + 1);
            renderAdminDashboard();
        });
    }

    function formatTimeForSlot(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
    }

    function getColorForPlan(planName) {
        if (!planName) return '#000';
        const name = planName.toLowerCase();
        if (name.includes('beginner')) return '#3b82f6'; // Blue
        if (name.includes('range')) return '#a855f7'; // Purple
        if (name.includes('9 hole') || name.includes('nine hole')) return '#22c55e'; // Green
        if (name.includes('18 hole')) return '#eab308'; // Yellow
        if (name.includes('simulator')) return '#ec4899'; // Pink
        return '#000'; // Default black
    }


    function parseDurationMins(planName) {
        if (!planName) return 60;
        const p = planName.toLowerCase();
        if (p.includes('nine holes') || p.includes('9 holes')) return 150;
        if (p.includes('18 holes')) return 300;
        if (p.includes('outside ikoyi')) return 1440;
        if (p.includes('simulator')) return 120;
        return 60;
    }

    function parseTimeStr(timeStr) {
        if (!timeStr) return 0;
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':');
        hours = parseInt(hours, 10);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours * 60 + parseInt(minutes, 10);
    }

    function updateAvailableTimeSlots(dateStr, timeSelectId, planSelectId, currentBookingId = null) {
        const timeSelect = document.getElementById(timeSelectId);
        const planSelect = document.getElementById(planSelectId);
        if (!timeSelect || !dateStr) return;

        const currentPlanDuration = parseDurationMins(planSelect ? planSelect.value : '');
        const todaysBookings = allBookings.filter(b =>
            b.booking_date === dateStr &&
            b.status !== 'cancelled' &&
            String(b.id) !== String(currentBookingId)
        );

        const isCandidateFullDay = (currentPlanDuration >= 1440);
        const hasExistingFullDay = todaysBookings.some(b => parseDurationMins(b.plan_name) >= 1440);

        const blockedRanges = [];
        if ((isCandidateFullDay && todaysBookings.length > 0) || hasExistingFullDay) {
            blockedRanges.push({ start: -9999, end: 9999 });
        } else {
            todaysBookings.forEach(b => {
                const startMins = parseTimeStr(b.booking_time);
                const durationMins = parseDurationMins(b.plan_name);
                blockedRanges.push({
                    start: startMins - GLOBAL_BUFFER_BEFORE,
                    end: startMins + durationMins + GLOBAL_BUFFER_AFTER
                });
            });
        }

        let allCandidates = [...GLOBAL_STANDARD_SLOTS];
        blockedRanges.forEach(range => {
            // The exact slot AFTER this booking:
            let afterCandidate = range.end + GLOBAL_BUFFER_BEFORE;
            if (afterCandidate >= GLOBAL_SCHEDULE_START && afterCandidate <= GLOBAL_SCHEDULE_END && !allCandidates.includes(afterCandidate)) {
                allCandidates.push(afterCandidate);
            }

            // The exact slot BEFORE this booking:
            let beforeCandidate = range.start - currentPlanDuration - GLOBAL_BUFFER_AFTER;
            if (beforeCandidate >= GLOBAL_SCHEDULE_START && beforeCandidate <= GLOBAL_SCHEDULE_END && !allCandidates.includes(beforeCandidate)) {
                allCandidates.push(beforeCandidate);
            }
        });
        allCandidates.sort((a, b) => a - b);

        const currentSelection = timeSelect.value;
        timeSelect.innerHTML = '';

        let firstAvailable = null;

        allCandidates.forEach(slotStart => {
            const slotEnd = slotStart + currentPlanDuration;
            const cStart = slotStart - GLOBAL_BUFFER_BEFORE;
            const cEnd = slotEnd + GLOBAL_BUFFER_AFTER;

            let isOverlapping = false;
            for (let range of blockedRanges) {
                if (cStart < range.end && cEnd > range.start) {
                    isOverlapping = true;
                    break;
                }
            }

            const hours = Math.floor(slotStart / 60);
            const mins = slotStart % 60;
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
            const displayMins = mins.toString().padStart(2, '0');
            const timeString = `${displayHours}:${displayMins} ${ampm}`;

            const opt = document.createElement('option');
            opt.value = timeString;
            opt.textContent = timeString;

            if (isOverlapping) {
                opt.disabled = true;
                opt.style.color = '#ccc';
            } else {
                if (!firstAvailable) firstAvailable = timeString;
            }

            timeSelect.appendChild(opt);
        });

        // Ensure current selection is maintained if it's still available
        let optionExists = Array.from(timeSelect.options).some(o => o.value === currentSelection && !o.disabled);
        if (optionExists && currentSelection !== '') {
            timeSelect.value = currentSelection;
        } else if (firstAvailable) {
            timeSelect.value = firstAvailable;
        }
    }

    let newDatePicker, editDatePicker;

    // Initialize Flatpickr after a short delay to ensure DOM is fully ready
    setTimeout(() => {
        if (window.flatpickr) {
            const newDateEl = document.getElementById('newDate');
            if (newDateEl) {
                newDatePicker = flatpickr(newDateEl, {
                    dateFormat: "Y-m-d",
                    minDate: "today",
                    disableMobile: "true",
                    onChange: function (selectedDates, dateStr) {
                        updateAvailableTimeSlots(dateStr, 'newTime', 'newPlanName');
                    }
                });
            }
            const editDateEl = document.getElementById('editDate');
            if (editDateEl) {
                editDatePicker = flatpickr(editDateEl, {
                    dateFormat: "Y-m-d",
                    disableMobile: "true",
                    onChange: function (selectedDates, dateStr) {
                        const currentId = document.getElementById('editBookingId').value;
                        updateAvailableTimeSlots(dateStr, 'editTime', 'editPlanName', currentId);
                    }
                });
            }
        }
    }, 500);

    // Bind plan changes to re-evaluate time slots
    const newPlanSelect = document.getElementById('newPlanName');
    if (newPlanSelect) {
        newPlanSelect.addEventListener('change', () => {
            if (newDatePicker && newDatePicker.selectedDates[0]) {
                updateAvailableTimeSlots(document.getElementById('newDate').value, 'newTime', 'newPlanName');
            }
        });
    }
    const editPlanSelect = document.getElementById('editPlanName');
    if (editPlanSelect) {
        editPlanSelect.addEventListener('change', () => {
            if (editDatePicker && editDatePicker.selectedDates[0]) {
                const currentId = document.getElementById('editBookingId').value;
                updateAvailableTimeSlots(document.getElementById('editDate').value, 'editTime', 'editPlanName', currentId);
            }
        });
    }

    let adminBookingsCurrentPage = 1;
    let adminClientsCurrentPage = 1;
    let adminPlansCurrentPage = 1;
    let adminItemsPerPage = 5;

    let bookingDateFilterValue = 'all';
    let recentActivityDateFilterValue = 'all';

    const searchInput = document.getElementById('bookingSearchInput');
    const statusSelect = document.getElementById('bookingStatusFilter');
    const dateSelect = document.getElementById('bookingDateFilter');
    const recentDateSelect = document.getElementById('recentActivityDateFilter');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            adminBookingsCurrentPage = 1;
            renderAdminDashboard();
        });
    }

    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            statusFilter = e.target.value;
            adminBookingsCurrentPage = 1;
            renderAdminDashboard();
        });
    }

    if (dateSelect) {
        dateSelect.addEventListener('change', (e) => {
            bookingDateFilterValue = e.target.value;
            adminBookingsCurrentPage = 1;
            renderAdminDashboard();
        });
    }

    if (recentDateSelect) {
        recentDateSelect.addEventListener('change', (e) => {
            recentActivityDateFilterValue = e.target.value;
            renderRecentActivity();
        });
    }

    // Exposed globally so admin.html can call it immediately after Clerk loads
    window.checkAdminAuth = function () {
        const user = window.Clerk ? window.Clerk.user : null;

        // If not logged in, redirect to index.
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        if (user.publicMetadata && user.publicMetadata.role === 'admin') {
            // Authorized
            document.getElementById('authLoader').style.display = 'none';
            fetchAdminBookings();
            // Trigger page-specific data loads that require auth
            if (typeof window.fetchClients === 'function' && document.getElementById('ClientsTableBody')) {
                window.fetchClients();
            }
        } else {
            // Unauthorized
            window.location.href = 'index.html';
        }
    };

    async function fetchGlobalClerkUsers() {
        try {
            const res = await window.apiFetch('api/users.php');
            const data = await res.json();
            if (data.status === 'success') {
                return data.data;
            }
        } catch (e) { }
        return [];
    }

    function getPlanPrice(planName) {
        if (!planName) return 0;
        const p = planName.toLowerCase();
        if (p.includes('nine holes')) return 40000;
        if (p.includes('18 holes')) return 60000;
        if (p.includes('outside ikoyi')) return 250000;
        if (p.includes('kids')) return 120000;
        if (p.includes('advanced')) return 200000;
        return 25000;
    }

    let revenueChartInstance = null;
    let planBreakdownChartInstance = null;

    async function calculateDashboardStats() {
        const statGolfers = document.getElementById('statGolfers');
        const statTotal = document.getElementById('statTotal');
        const statUpcoming = document.getElementById('statUpcoming');
        const statCompleted = document.getElementById('statCompleted');
        const statExpectedRev = document.getElementById('statExpectedRev');
        const statTotalRev = document.getElementById('statTotalRev');

        if (!statGolfers || !statTotal || !statUpcoming || !statCompleted) return;

        if (typeof window.globalClerkUsers === 'undefined') {
            window.globalClerkUsers = await fetchGlobalClerkUsers();
        }
        statGolfers.textContent = window.globalClerkUsers.length || 0;

        statTotal.textContent = allBookings.length;

        const upcomingLessons = allBookings.filter(b => (b.status || '').toLowerCase() === 'upcoming');
        if (statUpcoming) statUpcoming.textContent = upcomingLessons.length;

        const completedLessons = allBookings.filter(b => (b.status || '').toLowerCase() === 'completed');
        if (statCompleted) statCompleted.textContent = completedLessons.length;

        function formatCurrency(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
            return num;
        }

        const expectedRev = upcomingLessons.reduce((sum, b) => sum + getPlanPrice(b.plan_name), 0);
        if (statExpectedRev) statExpectedRev.textContent = '₦' + formatCurrency(expectedRev);

        const totalRev = completedLessons.reduce((sum, b) => sum + getPlanPrice(b.plan_name), 0);
        if (statTotalRev) statTotalRev.textContent = '₦' + formatCurrency(totalRev);

        renderCharts();
        renderRecentActivity();
    }

    function renderCharts() {
        const revCtx = document.getElementById('revenueChart');
        const planCtx = document.getElementById('planBreakdownChart');
        if (!revCtx || !planCtx || typeof Chart === 'undefined') return;

        // Group by plan
        const planCounts = {};
        allBookings.forEach(b => {
            if (b.status === 'cancelled') return;
            planCounts[b.plan_name] = (planCounts[b.plan_name] || 0) + 1;
        });

        // Group by date (Last 7 days logic, we'll just plot all upcoming/completed for simplicity, sorted by date)
        const dateRevenue = {};
        allBookings.forEach(b => {
            if (b.status === 'cancelled') return;
            const d = b.booking_date;
            dateRevenue[d] = (dateRevenue[d] || 0) + getPlanPrice(b.plan_name);
        });

        const sortedDates = Object.keys(dateRevenue).sort();
        // Take last 7 dates that have bookings
        const recentDates = sortedDates.slice(-7);
        const revData = recentDates.map(d => dateRevenue[d]);

        if (revenueChartInstance) revenueChartInstance.destroy();
        revenueChartInstance = new Chart(revCtx, {
            type: 'line',
            data: {
                labels: recentDates,
                datasets: [{
                    label: 'Revenue (₦)',
                    data: revData,
                    borderColor: '#0b1319',
                    backgroundColor: 'rgba(204, 255, 0, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

        if (planBreakdownChartInstance) planBreakdownChartInstance.destroy();
        planBreakdownChartInstance = new Chart(planCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(planCounts),
                datasets: [{
                    data: Object.values(planCounts),
                    backgroundColor: ['#ccff00', '#0b1319', '#f4f4f4', '#888', '#333', '#ddd'],
                    borderWidth: 2,
                    borderColor: '#fff',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                layout: {
                    padding: {
                        bottom: 10
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                family: "'Space Grotesk', sans-serif",
                                size: 11
                            },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8
                        }
                    }
                }
            }
        });
    }

    function renderRecentActivity() {
        const tbody = document.getElementById('recentBookingsBody');
        if (!tbody) return;

        let filtered = filterByDateRange(allBookings, recentActivityDateFilterValue);

        // Sort by ID descending (assuming newest first)
        const recent = [...filtered].sort((a, b) => b.id - a.id).slice(0, 5);
        tbody.innerHTML = '';

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No recent activity</td></tr>';
            return;
        }

        recent.forEach(b => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Date">${b.booking_date}</td>
                <td data-label="Golfer">${b.user_name}</td>
                <td data-label="Plan">${b.plan_name}</td>
                <td data-label="Status"><span class="status-badge status-${b.status}">${b.status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderAdminPagination(totalPages, stateVarName, containerId, renderFn) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        if (totalPages <= 1) return;

        let currentVal = adminBookingsCurrentPage;
        if (stateVarName === 'adminClientsCurrentPage') currentVal = adminClientsCurrentPage;
        if (stateVarName === 'adminPlansCurrentPage') currentVal = adminPlansCurrentPage;

        let html = `
            <button class="page-btn ${currentVal === 1 ? 'disabled' : ''}" data-page="${currentVal - 1}">Prev</button>
        `;

        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-btn ${i === currentVal ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        html += `
            <button class="page-btn ${currentVal === totalPages ? 'disabled' : ''}" data-page="${currentVal + 1}">Next</button>
        `;

        container.innerHTML = html;

        container.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newPage = parseInt(e.target.dataset.page);
                if (stateVarName === 'adminBookingsCurrentPage') {
                    adminBookingsCurrentPage = newPage;
                } else if (stateVarName === 'adminClientsCurrentPage') {
                    adminClientsCurrentPage = newPage;
                } else if (stateVarName === 'adminPlansCurrentPage') {
                    adminPlansCurrentPage = newPage;
                }
                renderFn();
            });
        });
    }

    async function fetchAdminBookings(silent = false) {
        try {
            const res = await window.apiFetch('api/bookings.php');
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
                if (data.status === 'success') {
                    if (silent && JSON.stringify(allBookings) === JSON.stringify(data.data)) {
                        return;
                    }
                    allBookings = data.data;
                }
            } catch (e) {
                if (!silent) console.warn("PHP API not reachable, falling back to localStorage.");
                const localData = JSON.parse(localStorage.getItem('smj_local_bookings') || '[]');
                if (silent && JSON.stringify(allBookings) === JSON.stringify(localData)) {
                    return;
                }
                allBookings = localData;
            }
        } catch (err) {
            if (!silent) console.error("Failed to fetch admin bookings:", err);
            return;
        }

        renderAdminDashboard();
        calculateDashboardStats();
    }

    // Listen to changes from user dashboard via polling
    setInterval(() => {
        // Only poll if no modals are open to avoid disrupting admin actions
        const editModal = document.getElementById('editBookingModal');
        const deleteModal = document.getElementById('deleteConfirmModal');

        if (editModal && editModal.classList.contains('show')) return;
        if (deleteModal && deleteModal.classList.contains('show')) return;

        fetchAdminBookings(true);
    }, 10000);

    function filterByDateRange(bookings, filterValue) {
        if (filterValue === 'all') return bookings;

        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA');

        if (filterValue === 'today') {
            return bookings.filter(b => b.booking_date === todayStr);
        }

        if (filterValue === 'week') {
            const currentDay = now.getDay();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - currentDay);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);

            return bookings.filter(b => {
                const bDate = new Date(b.booking_date);
                return bDate >= startOfWeek && bDate <= endOfWeek;
            });
        }

        if (filterValue === 'month') {
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            return bookings.filter(b => {
                const bDate = new Date(b.booking_date);
                return bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear;
            });
        }
        return bookings;
    }

    function renderCalendarView() {
        const grid = document.getElementById('dailyCalendarGrid');
        const dateDisplay = document.getElementById('calCurrentDateDisplay');
        if (!grid || !dateDisplay) return;

        dateDisplay.textContent = currentCalendarDate.toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

        const dateStr = currentCalendarDate.toLocaleDateString('en-CA');
        const daysBookings = allBookings.filter(b => b.booking_date === dateStr && b.status !== 'cancelled');

        let minStart = GLOBAL_SCHEDULE_START;
        let maxEnd = GLOBAL_SCHEDULE_END;

        daysBookings.forEach(booking => {
            const startMins = parseTimeStr(booking.booking_time);
            const endMins = startMins + parseDurationMins(booking.plan_name);
            if (startMins < minStart) minStart = startMins;
            if (endMins > maxEnd) maxEnd = endMins;
        });

        // Round to nearest hour bounds for a clean grid
        minStart = Math.floor(minStart / 60) * 60;
        maxEnd = Math.ceil(maxEnd / 60) * 60;

        let html = '<div class="time-axis"><div style="position: relative; margin-top: 20px;">';
        for (let t = minStart; t <= maxEnd; t += 60) {
            const pxOffset = t - minStart;
            html += `<div class="time-label" style="top: ${pxOffset}px;">${formatTimeForSlot(t)}</div>`;
        }
        html += '</div></div><div class="calendar-grid-wrapper"><div class="calendar-inner-grid" id="calendarGridContent">';

        // Render Dashed Slots (every 30 mins)
        for (let t = minStart; t < maxEnd; t += 30) {
            const pxOffset = t - minStart;
            html += `<div class="calendar-slot" style="top: ${pxOffset}px; height: 30px;" data-time="${formatTimeForSlot(t)}"></div>`;
        }

        html += '</div></div>';
        grid.innerHTML = html;

        const content = document.getElementById('calendarGridContent');

        // Simple overlap logic: sort by start time, then check overlaps
        daysBookings.sort((a, b) => parseTimeStr(a.booking_time) - parseTimeStr(b.booking_time));
        
        const placedEvents = [];

        daysBookings.forEach(booking => {
            const startMins = parseTimeStr(booking.booking_time);
            const duration = parseDurationMins(booking.plan_name);
            const endMins = startMins + duration;

            let overlapCount = 0;
            let overlapIndex = 0;

            // Very naive collision check for layout (could be optimized)
            const overlaps = daysBookings.filter(b => {
                const bStart = parseTimeStr(b.booking_time);
                const bEnd = bStart + parseDurationMins(b.plan_name);
                return Math.max(startMins, bStart) < Math.min(endMins, bEnd);
            });

            overlapCount = overlaps.length || 1;
            overlapIndex = overlaps.findIndex(b => b.id === booking.id);
            if (overlapIndex === -1) overlapIndex = 0;

            const width = 100 / overlapCount;
            const left = width * overlapIndex;
            const top = startMins - minStart;
            const height = duration;

            const el = document.createElement('div');
            el.className = 'calendar-event';
            el.style.top = `${top}px`;
            el.style.height = `${height}px`;
            el.style.width = `calc(${width}% - 10px)`;
            el.style.left = `calc(${left}% + 5px)`;
            el.style.backgroundColor = getColorForPlan(booking.plan_name);
            el.innerHTML = `
                <div class="event-title">${booking.user_name}</div>
                <div class="event-details">${booking.plan_name}</div>
                <div class="event-details">${booking.booking_time}</div>
            `;
            
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof openEditModal === 'function') openEditModal(booking);
            });

            content.appendChild(el);
        });

        // Slot click listeners
        document.querySelectorAll('.calendar-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const time = e.target.dataset.time;
                const newModal = document.getElementById('newBookingModal');
                if (newModal) {
                    newModal.classList.add('show');
                    document.getElementById('newDate').value = dateStr;
                    // Trigger flatpickr onChange manually if possible, or just set value
                    if (window.newDatePicker) window.newDatePicker.setDate(dateStr);
                    setTimeout(() => {
                        const timeSelect = document.getElementById('newTime');
                        if (timeSelect) {
                            timeSelect.value = time;
                        }
                    }, 100);
                }
            });
        });
    }

    function renderAdminDashboard() {
        const isBookingsPage = document.getElementById('dailyCalendarGrid') !== null;

        if (isBookingsPage) {
            if (currentAdminView === 'calendar') {
                if (tableViewContainer) tableViewContainer.style.display = 'none';
                if (calendarViewContainer) calendarViewContainer.style.display = 'block';
                if (adminFilters) adminFilters.style.display = 'none';
                // Also default the buttons UI on load
                const vTable = document.getElementById('viewToggleTable');
                const vCal = document.getElementById('viewToggleCalendar');
                if (vTable) vTable.classList.remove('active');
                if (vCal) vCal.classList.add('active');
                
                renderCalendarView();
            } else {
                if (tableViewContainer) tableViewContainer.style.display = 'block';
                if (calendarViewContainer) calendarViewContainer.style.display = 'none';
                if (adminFilters) adminFilters.style.display = 'flex';
                
                const vTable = document.getElementById('viewToggleTable');
                const vCal = document.getElementById('viewToggleCalendar');
                if (vTable) vTable.classList.add('active');
                if (vCal) vCal.classList.remove('active');
            }
        }

        const statTotal = document.getElementById('statTotal');
        if (statTotal) {
            statTotal.textContent = allBookings.length;
            const statUp = document.getElementById('statUpcoming');
            const statComp = document.getElementById('statCompleted');
            if (statUp) statUp.textContent = allBookings.filter(b => b.status === 'upcoming').length;
            if (statComp) statComp.textContent = allBookings.filter(b => b.status === 'completed').length;
        }

        const tbody = document.getElementById('bookingsTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (allBookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No bookings found.</td></tr>';
            return;
        }

        let filteredBookings = allBookings;

        if (statusFilter !== 'all') {
            filteredBookings = filteredBookings.filter(b => b.status === statusFilter);
        }

        filteredBookings = filterByDateRange(filteredBookings, bookingDateFilterValue);

        if (searchQuery !== '') {
            const tokens = searchQuery.split(/\s+/);
            filteredBookings = filteredBookings.filter(b => {
                const searchStr = `${b.user_name} ${b.plan_name} ${b.coach_name}`.toLowerCase();
                return tokens.every(token => searchStr.includes(token));
            });
        }

        if (filteredBookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No bookings match your filters.</td></tr>';
            const pagControls = document.getElementById('adminBookingsPagination');
            if (pagControls) pagControls.innerHTML = '';
            return;
        }

        filteredBookings.sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));

        // Pagination Logic
        const totalPages = Math.ceil(filteredBookings.length / adminItemsPerPage);
        if (adminBookingsCurrentPage > totalPages && totalPages > 0) adminBookingsCurrentPage = totalPages;

        const startIndex = (adminBookingsCurrentPage - 1) * adminItemsPerPage;
        const endIndex = startIndex + adminItemsPerPage;
        const pageBookings = filteredBookings.slice(startIndex, endIndex);

        pageBookings.forEach(booking => {
            const tr = document.createElement('tr');

            const dateObj = new Date(booking.booking_date);
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            const statusClass = booking.status === 'upcoming' ? 'status-upcoming' : (booking.status === 'cancelled' ? 'status-cancelled' : 'status-completed');

            tr.innerHTML = `
                <td data-label="Date & Time">
                    <div style="font-weight: 600; color: var(--text-dark);">${dateStr}</div>
                    <div style="color: var(--text-gray); font-size: 0.85rem; margin-top: 2px;">${booking.booking_time}</div>
                </td>
                <td data-label="Golfer"><div style="font-weight: 600; color: var(--text-dark); text-transform: capitalize;">${booking.user_name}</div></td>
                <td data-label="Plan"><div style="font-weight: 600; color: var(--text-dark);">${booking.plan_name}</div></td>
                <td data-label="Coach"><div style="color: var(--text-dark);">${booking.coach_name}</div></td>
                <td data-label="Status"><span class="status-badge ${statusClass}">${booking.status}</span></td>
                <td data-label="" style="white-space: nowrap;">
                    <button class="manage-btn" data-id="${booking.id}">Manage</button>
                    <button class="delete-btn" data-id="${booking.id}">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Attach action listeners if they exist
        document.querySelectorAll('.manage-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bookingId = e.target.dataset.id;
                const booking = allBookings.find(b => String(b.id) === String(bookingId));
                if (booking) openEditModal(booking);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                bookingToDeleteId = e.target.dataset.id;
                const deleteModal = document.getElementById('deleteConfirmModal');
                if (deleteModal) deleteModal.classList.add('show');
            });
        });

        if (typeof renderAdminPagination === 'function') {
            renderAdminPagination(totalPages, 'adminBookingsCurrentPage', 'adminBookingsPagination', renderAdminDashboard);
        }
    }

    // Modal Logic
    const editModal = document.getElementById('editBookingModal');
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const editForm = document.getElementById('editBookingForm');

    // Delete Modal Logic
    const deleteModal = document.getElementById('deleteConfirmModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    let bookingToDeleteId = null;

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            deleteModal.classList.remove('show');
            bookingToDeleteId = null;
        });
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (!bookingToDeleteId) return;

            confirmDeleteBtn.classList.add('loading');

            try {
                const res = await window.apiFetch('api/bookings.php', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: bookingToDeleteId, isAdmin: true })
                });
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    if (data.status === 'success') {
                        window.showToaster("Booking deleted successfully!");
                    } else {
                        window.showToaster(data.message || "Failed to delete", true);
                    }
                } catch (err) {
                    let localBookings = JSON.parse(localStorage.getItem('smj_local_bookings') || '[]');
                    localBookings = localBookings.filter(b => String(b.id) !== String(bookingToDeleteId));
                    localStorage.setItem('smj_local_bookings', JSON.stringify(localBookings));
                    window.showToaster("Booking deleted (Local Mode)");
                }
            } catch (err) {
                console.error(err);
            }

            confirmDeleteBtn.classList.remove('loading');
            deleteModal.classList.remove('show');
            bookingToDeleteId = null;
            fetchAdminBookings();
        });
    }

    function openEditModal(booking) {
        document.getElementById('editBookingId').value = booking.id;
        document.getElementById('editGolferName').value = booking.user_name;
        document.getElementById('editPlanName').value = booking.plan_name;
        document.getElementById('editCoachName').value = booking.coach_name;
        document.getElementById('editDate').value = booking.booking_date;
        document.getElementById('editTime').value = booking.booking_time;
        document.getElementById('editStatus').value = booking.status;

        editModal.classList.add('show');
    }

    const closeEditModalTopBtn = document.getElementById('closeEditModalTopBtn');
    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener('click', () => {
            editModal.classList.remove('show');
        });
    }
    if (closeEditModalTopBtn) {
        closeEditModalTopBtn.addEventListener('click', () => {
            editModal.classList.remove('show');
        });
    }

    const newModal = document.getElementById('newBookingModal');
    const openNewModalBtn = document.getElementById('openNewBookingModalBtn');
    const closeNewModalBtn = document.getElementById('closeNewModalBtn');
    const closeNewModalTopBtn = document.getElementById('closeNewModalTopBtn');
    const newBookingForm = document.getElementById('newBookingForm');

    let allClerkUsers = [];

    if (openNewModalBtn) {
        openNewModalBtn.addEventListener('click', async () => {
            if (newModal) newModal.classList.add('show');

            const searchInput = document.getElementById('newGolferSearch');
            const listElement = document.getElementById('newGolferList');
            const idInput = document.getElementById('newGolferId');

            if (searchInput && listElement) {
                searchInput.value = 'Loading...';
                searchInput.disabled = true;

                if (window.globalClerkUsers && window.globalClerkUsers.length > 0) {
                    allClerkUsers = window.globalClerkUsers;
                    searchInput.value = '';
                    searchInput.disabled = false;
                    searchInput.placeholder = 'Search ' + allClerkUsers.length + ' registered golfers...';
                } else {
                    try {
                        const res = await window.apiFetch('api/users.php');
                        const data = await res.json();
                        if (data.status === 'success') {
                            window.globalClerkUsers = data.data;
                            allClerkUsers = data.data;
                            searchInput.value = '';
                            searchInput.disabled = false;
                            searchInput.placeholder = 'Search ' + allClerkUsers.length + ' registered golfers...';
                        } else {
                            searchInput.value = 'Failed to load users';
                        }
                    } catch (e) {
                        searchInput.value = 'Error loading users';
                    }
                }

                // Search filtering logic
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    listElement.innerHTML = '';

                    if (query.trim() === '') {
                        listElement.style.display = 'none';
                        return;
                    }

                    const filtered = allClerkUsers.filter(u =>
                        u.name.toLowerCase().includes(query) ||
                        u.email.toLowerCase().includes(query)
                    );

                    if (filtered.length > 0) {
                        filtered.forEach(u => {
                            const li = document.createElement('li');
                            li.textContent = `${u.name} (${u.email})`;
                            li.addEventListener('click', () => {
                                searchInput.value = u.name;
                                idInput.value = u.id;
                                listElement.style.display = 'none';
                            });
                            listElement.appendChild(li);
                        });
                        listElement.style.display = 'block';
                    } else {
                        listElement.style.display = 'none';
                    }
                });

                // Hide list when clicking outside
                document.addEventListener('click', (e) => {
                    if (e.target !== searchInput && e.target !== listElement) {
                        listElement.style.display = 'none';
                    }
                });
            }
        });
    }

    if (closeNewModalBtn) {
        closeNewModalBtn.addEventListener('click', () => {
            if (newModal) newModal.classList.remove('show');
        });
    }
    if (closeNewModalTopBtn) {
        closeNewModalTopBtn.addEventListener('click', () => {
            if (newModal) newModal.classList.remove('show');
        });
    }

    if (newBookingForm) {
        newBookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const idInput = document.getElementById('newGolferId');
            const searchInput = document.getElementById('newGolferSearch');

            if (!idInput.value) {
                window.showToaster("Please select a golfer from the dropdown list.", true);
                return;
            }

            const btn = document.getElementById('saveNewBtn');
            btn.classList.add('loading');

            const payload = {
                user_id: idInput.value,
                user_name: searchInput.value,
                plan_name: document.getElementById('newPlanName').value,
                coach_name: document.getElementById('newCoachName').value,
                booking_date: document.getElementById('newDate').value,
                booking_time: document.getElementById('newTime').value
            };

            try {
                const res = await window.apiFetch('api/bookings.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    if (data.status === 'success') {
                        window.showToaster("Booking created successfully!");
                        if (newModal) newModal.classList.remove('show');
                        newBookingForm.reset();
                        idInput.value = '';
                        fetchAdminBookings();
                    } else {
                        window.showToaster(data.message || "Failed to create booking", true);
                    }
                } catch (err) {
                    window.showToaster("Booking creation failed (Server error)", true);
                }
            } catch (err) {
                console.error(err);
                window.showToaster("Network error", true);
            }
            btn.classList.remove('loading');
        });
    }
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('saveEditBtn');
            btn.classList.add('loading');

            const payload = {
                id: document.getElementById('editBookingId').value,
                user_name: document.getElementById('editGolferName').value,
                plan_name: document.getElementById('editPlanName').value,
                coach_name: document.getElementById('editCoachName').value,
                booking_date: document.getElementById('editDate').value,
                booking_time: document.getElementById('editTime').value,
                status: document.getElementById('editStatus').value,
                isAdmin: true
            };

            // Proper validation: Check if trying to mark a future booking as completed
            if (payload.status === 'completed') {
                const [year, month, day] = payload.booking_date.split('-');
                const [timeStr, modifier] = payload.booking_time.split(' ');
                let [hours, minutes] = timeStr.split(':');
                hours = parseInt(hours, 10);
                if (modifier === 'PM' && hours < 12) hours += 12;
                if (modifier === 'AM' && hours === 12) hours = 0;

                const bookingDateTime = new Date(year, month - 1, day, hours, parseInt(minutes, 10));
                const now = new Date();

                if (bookingDateTime > now) {
                    window.showToaster("Validation Error: Cannot mark a future booking as completed.", true);
                    btn.classList.remove('loading');
                    return;
                }
            }

            try {
                const res = await window.apiFetch('api/bookings.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    if (data.status === 'success') {
                        window.showToaster("Booking updated successfully!");
                        editModal.classList.remove('show');
                    } else {
                        window.showToaster(data.message || "Failed to update booking", true);
                    }
                } catch (err) {
                    let localBookings = JSON.parse(localStorage.getItem('smj_local_bookings') || '[]');
                    const index = localBookings.findIndex(b => String(b.id) === String(payload.id));
                    if (index > -1) {
                        localBookings[index] = { ...localBookings[index], ...payload };
                        localStorage.setItem('smj_local_bookings', JSON.stringify(localBookings));
                    }
                    window.showToaster("Booking updated (Local Mode)");
                    editModal.classList.remove('show');
                }
            } catch (err) {
                console.error(err);
                window.showToaster("Network error", true);
            }

            btn.classList.remove('loading');
            fetchAdminBookings();
        });
    }

    // ============================================
    // Client MANAGEMENT LOGIC
    // ============================================
    const ClientsTableBody = document.getElementById('ClientsTableBody');
    if (ClientsTableBody) {
        let allClients = [];
        let ClientSearchQuery = '';

        // Modal State
        let currentViewBookingsData = [];
        let currentViewBookingsSortDesc = true;

        const vSearch = document.getElementById('viewBookingsSearch');
        const vFilter = document.getElementById('viewBookingsStatusFilter');
        const vSortBtn = document.getElementById('viewBookingsSortBtn');

        if (vSearch) vSearch.addEventListener('input', renderViewBookingsTable);
        if (vFilter) vFilter.addEventListener('change', renderViewBookingsTable);
        if (vSortBtn) {
            vSortBtn.addEventListener('click', () => {
                currentViewBookingsSortDesc = !currentViewBookingsSortDesc;
                vSortBtn.textContent = currentViewBookingsSortDesc ? 'Sort: Newest' : 'Sort: Oldest';
                renderViewBookingsTable();
            });
        }

        function renderViewBookingsTable() {
            const tbody = document.getElementById('viewBookingsTableBody');
            if (!tbody) return;

            const searchQ = vSearch ? vSearch.value.toLowerCase().trim() : '';
            const statusF = vFilter ? vFilter.value : 'all';

            let filtered = currentViewBookingsData;

            if (statusF !== 'all') {
                filtered = filtered.filter(b => b.status === statusF);
            }

            if (searchQ) {
                const tokens = searchQ.split(/\s+/);
                filtered = filtered.filter(b => {
                    const str = `${b.plan_name} ${b.coach_name}`.toLowerCase();
                    return tokens.every(token => str.includes(token));
                });
            }

            filtered.sort((a, b) => {
                const dA = new Date(a.booking_date);
                const dB = new Date(b.booking_date);
                return currentViewBookingsSortDesc ? dB - dA : dA - dB;
            });

            tbody.innerHTML = '';
            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No history found.</td></tr>';
                return;
            }

            filtered.forEach(b => {
                const dStr = new Date(b.booking_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const statusClass = b.status === 'upcoming' ? 'status-upcoming' : (b.status === 'cancelled' ? 'status-cancelled' : 'status-completed');

                tbody.innerHTML += `
                    <tr>
                        <td><div style="font-weight:600">${dStr}</div><div style="font-size:0.85rem; color:var(--text-gray);">${b.booking_time}</div></td>
                        <td>${b.plan_name}</td>
                        <td>${b.coach_name}</td>
                        <td><span class="status-badge ${statusClass}">${b.status}</span></td>
                    </tr>
                `;
            });
        }

        const ClientSearchInput = document.getElementById('ClientsearchInput');
        if (ClientSearchInput) {
            ClientSearchInput.addEventListener('input', (e) => {
                ClientSearchQuery = e.target.value.toLowerCase().trim();
                adminClientsCurrentPage = 1;
                renderClientsTable();
            });
        }

        window.fetchClients = async function fetchClients() {
            try {
                const res = await window.apiFetch('api/clients.php');
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    if (data.status === 'success') {
                        allClients = data.data;
                    }
                } catch (e) {
                    allClients = JSON.parse(localStorage.getItem('smj_local_Clients') || '[]');
                }
            } catch (err) {
                allClients = JSON.parse(localStorage.getItem('smj_local_Clients') || '[]');
            }
            renderClientsTable();
        }

        function renderClientsTable() {
            ClientsTableBody.innerHTML = '';

            let filtered = allClients;
            if (ClientSearchQuery !== '') {
                const tokens = ClientSearchQuery.split(/\s+/);
                filtered = filtered.filter(c => {
                    const str = `${c.name} ${c.email}`.toLowerCase();
                    return tokens.every(token => str.includes(token));
                });
            }

            if (filtered.length === 0) {
                ClientsTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No users found.</td></tr>';
                const pagControls = document.getElementById('adminClientsPagination');
                if (pagControls) pagControls.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(filtered.length / adminItemsPerPage);
            if (adminClientsCurrentPage > totalPages && totalPages > 0) adminClientsCurrentPage = totalPages;

            const startIndex = (adminClientsCurrentPage - 1) * adminItemsPerPage;
            const endIndex = startIndex + adminItemsPerPage;
            const pageClients = filtered.slice(startIndex, endIndex);

            pageClients.forEach(c => {
                const tr = document.createElement('tr');
                const lastActiveObj = new Date(c.last_active);
                const lastActiveStr = lastActiveObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                tr.innerHTML = `
                    <td data-label="Name"><div style="font-weight: 600; color: var(--text-dark); text-transform: capitalize;">${c.name}</div></td>
                    <td data-label="Email"><div style="color: var(--text-dark);">${c.email || '-'}</div></td>
                    <td data-label="Total Bookings"><div style="font-weight: 600; color: var(--text-dark);">${c.total_bookings}</div></td>
                    <td data-label="Last Active"><div style="color: var(--text-gray);">${lastActiveStr}</div></td>
                    <td data-label="" style="white-space: nowrap;">
                        <button class="view-bookings-btn" data-id="${c.user_id}" data-name="${c.name}" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; background: var(--text-dark); color: white; border: 2px solid var(--text-dark); cursor: pointer; margin-right: 0.5rem;">View Bookings</button>
                        <button class="delete-Client-btn" data-id="${c.user_id}" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; background: #ef4444; color: white; border: 2px solid #ef4444; cursor: pointer;">Delete</button>
                    </td>
                `;
                ClientsTableBody.appendChild(tr);
            });

            if (typeof renderAdminPagination === 'function') {
                renderAdminPagination(totalPages, 'adminClientsCurrentPage', 'adminClientsPagination', renderClientsTable);
            }

            // View Bookings Action
            document.querySelectorAll('.view-bookings-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const userId = e.target.dataset.id;
                    const userName = e.target.dataset.name;
                    document.getElementById('viewBookingsName').textContent = userName;
                    const tbody = document.getElementById('viewBookingsTableBody');
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';

                    if (vSearch) vSearch.value = '';
                    if (vFilter) vFilter.value = 'all';
                    currentViewBookingsSortDesc = true;
                    if (vSortBtn) vSortBtn.textContent = 'Sort: Newest';

                    document.getElementById('viewBookingsModal').classList.add('show');

                    try {
                        const res = await window.apiFetch(`api/bookings.php?user_id=${userId}`);
                        const text = await res.text();
                        let bData = [];
                        try {
                            const data = JSON.parse(text);
                            if (data.status === 'success') bData = data.data;
                        } catch (err) {
                            // Local fallback
                            const allB = JSON.parse(localStorage.getItem('smj_local_bookings') || '[]');
                            bData = allB.filter(b => b.user_id === userId);
                        }

                        currentViewBookingsData = bData;
                        renderViewBookingsTable();

                    } catch (e) {
                        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#ef4444;">Error loading bookings.</td></tr>';
                    }
                });
            });

            document.querySelectorAll('.delete-Client-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    ClientToDeleteId = e.target.dataset.id;
                    const modal = document.getElementById('deleteCustomerModal');
                    if (modal) modal.classList.add('show');
                });
            });
        }

        // fetchClients() is now triggered by checkAdminAuth() after Clerk auth is confirmed

        // Close View Bookings Modal
        const closeViewBookingsBtn = document.getElementById('closeViewBookingsBtn');
        if (closeViewBookingsBtn) {
            closeViewBookingsBtn.addEventListener('click', () => {
                document.getElementById('viewBookingsModal').classList.remove('show');
            });
        }

        // Delete Client Logic
        let ClientToDeleteId = null;
        const deleteClientModal = document.getElementById('deleteCustomerModal');
        const cancelDeleteClientBtn = document.getElementById('cancelDeleteCustomerBtn');
        const confirmDeleteClientBtn = document.getElementById('confirmDeleteCustomerBtn');

        if (cancelDeleteClientBtn) {
            cancelDeleteClientBtn.addEventListener('click', () => {
                ClientToDeleteId = null;
                deleteClientModal.classList.remove('show');
            });
        }

        if (confirmDeleteClientBtn) {
            confirmDeleteClientBtn.addEventListener('click', async () => {
                if (!ClientToDeleteId) return;
                confirmDeleteClientBtn.classList.add('loading');

                try {
                    const res = await window.apiFetch('api/clients.php', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: ClientToDeleteId })
                    });
                    const text = await res.text();
                    try {
                        const data = JSON.parse(text);
                        if (data.status !== 'success') throw new Error();
                    } catch (err) {
                        // local fallback
                        let localB = JSON.parse(localStorage.getItem('smj_local_bookings') || '[]');
                        localB = localB.filter(b => b.user_id !== ClientToDeleteId);
                        localStorage.setItem('smj_local_bookings', JSON.stringify(localB));
                    }

                    window.showToaster ? window.showToaster("User data wiped") : alert("Deleted");
                    deleteClientModal.classList.remove('show');
                    fetchClients();
                } catch (e) {
                    window.showToaster ? window.showToaster("Error deleting", true) : alert("Error");
                }
                confirmDeleteClientBtn.classList.remove('loading');
            });
        }
    }

    // ==========================================
    // PLAN MANAGEMENT LOGIC
    // ==========================================
    const plansTableBody = document.getElementById('plansTableBody');
    if (plansTableBody) {
        let allPlans = [];
        let planSearchQuery = '';
        const planSearchInput = document.getElementById('planSearchInput');

        if (planSearchInput) {
            planSearchInput.addEventListener('input', (e) => {
                planSearchQuery = e.target.value.toLowerCase().trim();
                adminPlansCurrentPage = 1;
                renderPlansTable();
            });
        }

        async function fetchPlans() {
            try {
                const res = await window.apiFetch('api/plans.php');
                const text = await res.text();
                try {
                    const data = JSON.parse(text);
                    if (data.status === 'success') {
                        const dbPlans = data.data;
                        // Merge any localStorage-only plans that aren't in the DB
                        const localP = JSON.parse(localStorage.getItem('smj_local_plans') || '[]');
                        const localOnly = localP.filter(lp => !dbPlans.some(dp => String(dp.id) === String(lp.id)));
                        allPlans = [...dbPlans, ...localOnly];
                    } else {
                        allPlans = JSON.parse(localStorage.getItem('smj_local_plans') || '[]');
                    }
                } catch (e) {
                    allPlans = JSON.parse(localStorage.getItem('smj_local_plans') || '[]');
                }
            } catch (e) {
                allPlans = JSON.parse(localStorage.getItem('smj_local_plans') || '[]');
            }
            renderPlansTable();
        }

        function renderPlansTable() {
            plansTableBody.innerHTML = '';
            let filtered = allPlans;
            if (planSearchQuery !== '') {
                const tokens = planSearchQuery.split(/\s+/);
                filtered = filtered.filter(p => {
                    const str = (p.title + ' ' + p.category + ' ' + p.price + ' ' + p.duration).toLowerCase();
                    return tokens.every(t => str.includes(t));
                });
            }

            if (filtered.length === 0) {
                plansTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No plans found.</td></tr>';
                const pagControls = document.getElementById('adminPlansPagination');
                if (pagControls) pagControls.innerHTML = '';
                return;
            }

            const totalPages = Math.ceil(filtered.length / adminItemsPerPage);
            if (adminPlansCurrentPage > totalPages && totalPages > 0) adminPlansCurrentPage = totalPages;

            const startIndex = (adminPlansCurrentPage - 1) * adminItemsPerPage;
            const endIndex = startIndex + adminItemsPerPage;
            const pagePlans = filtered.slice(startIndex, endIndex);

            pagePlans.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${p.title}</strong>${p.is_premium ? ' <span style="background:var(--accent);font-size:10px;padding:2px 4px;color:black;">Premium</span>' : ''}</td>
                    <td style="text-transform: capitalize;">${p.category}</td>
                    <td>₦${Number(p.price).toLocaleString()}</td>
                    <td>${p.duration}</td>
                    <td>
                        <button class="edit-plan-btn" data-id="${p.id}" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; background: var(--text-dark); color: white; border: 2px solid var(--text-dark); cursor: pointer; margin-right: 0.5rem;">Edit</button>
                        <button class="delete-plan-btn" data-id="${p.id}" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; background: #ef4444; color: white; border: 2px solid #ef4444; cursor: pointer;">Delete</button>
                    </td>
                `;
                plansTableBody.appendChild(tr);
            });

            if (typeof renderAdminPagination === 'function') {
                renderAdminPagination(totalPages, 'adminPlansCurrentPage', 'adminPlansPagination', renderPlansTable);
            }

            document.querySelectorAll('.delete-plan-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    planToDeleteId = e.target.dataset.id;
                    const modal = document.getElementById('deletePlanModal');
                    if (modal) modal.classList.add('show');
                });
            });

            document.querySelectorAll('.edit-plan-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    const p = allPlans.find(plan => String(plan.id) === String(id));
                    if (p) {
                        planToEditId = p.id;
                        document.getElementById('planModalTitle').textContent = 'Edit Plan';
                        document.getElementById('planInputTitle').value = p.title;
                        document.getElementById('planInputCategory').value = p.category;
                        document.getElementById('planInputPrice').value = p.price;
                        document.getElementById('planInputDuration').value = p.duration;
                        document.getElementById('planInputFeatures').value = Array.isArray(p.features) ? p.features.join('\n') : '';
                        document.getElementById('planInputPremium').checked = !!p.is_premium;
                        const modal = document.getElementById('planModal');
                        if (modal) modal.classList.add('show');
                    }
                });
            });
        }

        fetchPlans();

        // Add Plan Modal Logic
        let planToEditId = null;
        const addPlanBtn = document.getElementById('addPlanBtn');
        const planModal = document.getElementById('planModal');
        const cancelPlanModal = document.getElementById('cancelPlanModal');
        const savePlanBtn = document.getElementById('savePlanBtn');

        if (addPlanBtn && planModal) {
            addPlanBtn.addEventListener('click', () => {
                planToEditId = null;
                document.getElementById('planModalTitle').textContent = 'Add New Plan';
                document.getElementById('planInputTitle').value = '';
                document.getElementById('planInputCategory').value = 'onetime';
                document.getElementById('planInputPrice').value = '';
                document.getElementById('planInputDuration').value = '';
                document.getElementById('planInputFeatures').value = '';
                document.getElementById('planInputPremium').checked = false;
                planModal.classList.add('show');
            });
        }

        if (cancelPlanModal) {
            cancelPlanModal.addEventListener('click', () => planModal.classList.remove('show'));
        }

        if (savePlanBtn) {
            savePlanBtn.addEventListener('click', async () => {
                const title = document.getElementById('planInputTitle').value.trim();
                const category = document.getElementById('planInputCategory').value;
                const price = document.getElementById('planInputPrice').value;
                const duration = document.getElementById('planInputDuration').value.trim();
                const featuresRaw = document.getElementById('planInputFeatures').value;
                const isPremium = document.getElementById('planInputPremium').checked;

                if (!title || !price || !duration || !featuresRaw) {
                    window.showToaster ? window.showToaster("Please fill all fields", true) : alert("Please fill all fields");
                    return;
                }

                const features = featuresRaw.split('\n').map(f => f.trim()).filter(f => f.length > 0);
                savePlanBtn.classList.add('loading');

                const payload = {
                    title, category, price: parseInt(price), duration, features, is_premium: isPremium
                };

                if (planToEditId) {
                    payload.id = planToEditId;
                }

                try {
                    const res = await window.apiFetch('api/plans.php', {
                        method: planToEditId ? 'PUT' : 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const text = await res.text();
                    let savedToDb = false;
                    let errMsg = '';
                    try {
                        const data = JSON.parse(text);
                        if (data.status === 'success') {
                            savedToDb = true;
                        } else {
                            errMsg = data.message || 'Database error. Saving locally.';
                        }
                    } catch (parseErr) {
                        errMsg = 'Unexpected server response. Saving locally.';
                    }

                    if (!savedToDb) {
                        // Fallback: save to localStorage so plan still appears in table
                        const localP = JSON.parse(localStorage.getItem('smj_local_plans') || '[]');
                        if (planToEditId) {
                            const idx = localP.findIndex(p => String(p.id) === String(planToEditId));
                            if (idx >= 0) localP[idx] = { ...payload, id: planToEditId };
                            else localP.push({ ...payload, id: planToEditId });
                        } else {
                            localP.push({ ...payload, id: Date.now() });
                        }
                        localStorage.setItem('smj_local_plans', JSON.stringify(localP));
                        console.warn('Plan saved locally (DB error):', errMsg);
                        window.showToaster ? window.showToaster('Plan saved locally. Note: ' + errMsg) : alert('Saved locally: ' + errMsg);
                    } else {
                        window.showToaster ? window.showToaster('Plan saved!') : alert('Plan saved');
                    }
                    planModal.classList.remove('show');
                    fetchPlans();
                } catch (e) {
                    window.showToaster ? window.showToaster('Failed to save plan: ' + e.message, true) : alert('Error saving plan');
                }
                savePlanBtn.classList.remove('loading');
            });
        }

        // Delete Plan Logic
        let planToDeleteId = null;
        const deletePlanModal = document.getElementById('deletePlanModal');
        const cancelDeletePlanBtn = document.getElementById('cancelDeletePlanBtn');
        const confirmDeletePlanBtn = document.getElementById('confirmDeletePlanBtn');
        const closeDeletePlanModal = document.getElementById('closeDeletePlanModal');

        const closePlanDelete = () => {
            planToDeleteId = null;
            if (deletePlanModal) deletePlanModal.classList.remove('show');
        };

        if (cancelDeletePlanBtn) cancelDeletePlanBtn.addEventListener('click', closePlanDelete);
        if (closeDeletePlanModal) closeDeletePlanModal.addEventListener('click', closePlanDelete);

        if (confirmDeletePlanBtn) {
            confirmDeletePlanBtn.addEventListener('click', async () => {
                if (!planToDeleteId) return;
                confirmDeletePlanBtn.classList.add('loading');
                try {
                    const res = await window.apiFetch('api/plans.php', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: planToDeleteId })
                    });
                    const text = await res.text();
                    try {
                        const data = JSON.parse(text);
                        if (data.status !== 'success') throw new Error();
                    } catch (err) {
                        // local fallback
                        let localP = JSON.parse(localStorage.getItem('smj_local_plans') || '[]');
                        localP = localP.filter(p => String(p.id) !== String(planToDeleteId));
                        localStorage.setItem('smj_local_plans', JSON.stringify(localP));
                    }

                    window.showToaster ? window.showToaster("Plan deleted") : alert("Deleted");
                    closePlanDelete();
                    fetchPlans();
                } catch (e) {
                    window.showToaster ? window.showToaster("Error deleting", true) : alert("Error");
                }
                confirmDeletePlanBtn.classList.remove('loading');
            });
        }
    }

    // Settings Page Logic
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        // Fetch Settings on Load
        async function fetchSettings() {
            try {
                const res = await window.apiFetch('api/settings.php');
                const text = await res.text();
                const data = JSON.parse(text);

                if (data.status === 'success' && data.data) {
                    const s = data.data;
                    if (s.schedule_start) document.getElementById('schedule_start').value = s.schedule_start;
                    if (s.schedule_end) document.getElementById('schedule_end').value = s.schedule_end;
                    if (s.buffer_before !== undefined) document.getElementById('buffer_before').value = s.buffer_before;
                    if (s.buffer_after !== undefined) document.getElementById('buffer_after').value = s.buffer_after;

                    if (s.working_days) {
                        const daysArray = s.working_days.split(',');
                        document.querySelectorAll('.working-day-cb').forEach(cb => {
                            cb.checked = daysArray.includes(cb.value);
                        });
                    }

                    if (s.blocked_dates) {
                        const datesArray = s.blocked_dates.split(',').filter(d => d.trim() !== '');
                        datesArray.forEach(dateStr => addBlockedDateToUI(dateStr));
                    }
                    if (s.cancellation_window_hours) document.getElementById('cancellation_window_hours').value = s.cancellation_window_hours;
                    if (s.advance_booking_days) document.getElementById('advance_booking_days').value = s.advance_booking_days;
                    if (s.paystack_test_mode) document.getElementById('paystack_test_mode').value = s.paystack_test_mode;
                    if (s.paystack_enabled) {
                        const isEnabled = s.paystack_enabled === 'true';
                        document.getElementById('paystack_enabled').checked = isEnabled;
                        document.getElementById('paystack_config').style.display = isEnabled ? 'block' : 'none';
                    } else {
                        document.getElementById('paystack_enabled').checked = false;
                        document.getElementById('paystack_config').style.display = 'none';
                    }
                    if (s.cash_enabled) document.getElementById('cash_enabled').checked = s.cash_enabled === 'true';
                    if (s.paystack_public_key) document.getElementById('paystack_public_key').value = s.paystack_public_key;
                    if (s.paystack_secret_key) document.getElementById('paystack_secret_key').placeholder = "********";
                    if (s.admin_email) document.getElementById('admin_email').value = s.admin_email;
                    if (s.email_automations) document.getElementById('email_automations').value = s.email_automations;
                }
            } catch (err) {
                console.warn('Could not load settings from server, checking local storage.');
                const localSettings = JSON.parse(localStorage.getItem('smj_local_settings') || '{}');
                if (Object.keys(localSettings).length > 0) {
                    const s = localSettings;
                    if (s.schedule_start) document.getElementById('schedule_start').value = s.schedule_start;
                    if (s.schedule_end) document.getElementById('schedule_end').value = s.schedule_end;
                    if (s.cancellation_window_hours) document.getElementById('cancellation_window_hours').value = s.cancellation_window_hours;
                    if (s.advance_booking_days) document.getElementById('advance_booking_days').value = s.advance_booking_days;
                    if (s.paystack_test_mode) document.getElementById('paystack_test_mode').value = s.paystack_test_mode;
                    if (s.paystack_enabled) {
                        const isEnabled = s.paystack_enabled === 'true';
                        document.getElementById('paystack_enabled').checked = isEnabled;
                        document.getElementById('paystack_config').style.display = isEnabled ? 'block' : 'none';
                    } else {
                        document.getElementById('paystack_enabled').checked = false;
                        document.getElementById('paystack_config').style.display = 'none';
                    }
                    if (s.cash_enabled) document.getElementById('cash_enabled').checked = s.cash_enabled === 'true';
                    if (s.paystack_public_key) document.getElementById('paystack_public_key').value = s.paystack_public_key;
                    if (s.admin_email) document.getElementById('admin_email').value = s.admin_email;
                    if (s.email_automations) document.getElementById('email_automations').value = s.email_automations;
                }
            }
        }

        fetchSettings();

        // Save Settings
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('saveSettingsBtn');
            const originalText = btn.textContent;
            btn.textContent = 'Saving...';
            btn.style.pointerEvents = 'none';

            // Collect working days
            const checkedDays = Array.from(document.querySelectorAll('.working-day-cb'))
                .filter(cb => cb.checked)
                .map(cb => cb.value)
                .join(',');

            // Collect blocked dates
            const blockedDates = Array.from(document.querySelectorAll('.blocked-date-item'))
                .map(item => item.dataset.date)
                .join(',');

            const payload = {
                schedule_start: document.getElementById('schedule_start').value,
                schedule_end: document.getElementById('schedule_end').value,
                buffer_before: document.getElementById('buffer_before').value,
                buffer_after: document.getElementById('buffer_after').value,
                working_days: checkedDays,
                blocked_dates: blockedDates,
                cancellation_window_hours: document.getElementById('cancellation_window_hours').value,
                advance_booking_days: document.getElementById('advance_booking_days').value,
                paystack_test_mode: document.getElementById('paystack_test_mode').value,
                paystack_enabled: document.getElementById('paystack_enabled').checked ? 'true' : 'false',
                cash_enabled: document.getElementById('cash_enabled').checked ? 'true' : 'false',
                paystack_public_key: document.getElementById('paystack_public_key').value,
                admin_email: document.getElementById('admin_email').value,
                email_automations: document.getElementById('email_automations').value
            };

            // Only update secret key if they typed a new one
            const newSecret = document.getElementById('paystack_secret_key').value;
            if (newSecret && newSecret.trim() !== '') {
                payload.paystack_secret_key = newSecret;
            }

            try {
                const res = await window.apiFetch('api/settings.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const text = await res.text();
                const data = JSON.parse(text);

                if (data.status === 'success') {
                    window.showToaster ? window.showToaster('Settings saved successfully!') : alert('Settings saved successfully!');
                } else {
                    window.showToaster ? window.showToaster(data.message || 'Failed to save settings.', true) : alert('Failed to save settings.');
                }
            } catch (err) {
                console.error(err);
                localStorage.setItem('smj_local_settings', JSON.stringify(payload));
                window.showToaster ? window.showToaster('Settings saved locally.') : alert('Settings saved locally.');
            }

            btn.textContent = originalText;
            btn.style.pointerEvents = 'auto';
        });

        // Blocked Dates UI Logic
        const addBlockedDateBtn = document.getElementById('addBlockedDateBtn');
        const newBlockedDateInput = document.getElementById('new_blocked_date');
        const blockedDatesList = document.getElementById('blocked_dates_list');

        // Initialize Flatpickr for the modern calendar
        if (window.flatpickr && newBlockedDateInput) {
            flatpickr(newBlockedDateInput, {
                mode: "range",
                dateFormat: "Y-m-d",
                disableMobile: "true",
                minDate: "today"
            });
        }

        function addBlockedDateToUI(dateStr) {
            // Check if already exists
            const existing = document.querySelector(`.blocked-date-item[data-date="${dateStr}"]`);
            if (existing) return;

            const div = document.createElement('div');
            div.className = 'blocked-date-item';
            div.dataset.date = dateStr;
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.padding = '0.5rem 1rem';
            div.style.background = '#f9fafb';
            div.style.border = '2px solid var(--text-dark)';

            const dateObj = new Date(dateStr);
            const formatted = dateObj.toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            div.innerHTML = `
                <span style="font-weight: 500;">${formatted}</span>
                <button type="button" class="btn remove-date-btn" style="padding: 0.25rem 0.75rem; background: transparent; color: red; border: 2px solid red;">Remove</button>
            `;

            div.querySelector('.remove-date-btn').addEventListener('click', () => {
                div.remove();
            });

            blockedDatesList.appendChild(div);
        }

        if (addBlockedDateBtn && newBlockedDateInput) {
            addBlockedDateBtn.addEventListener('click', async () => {
                const val = newBlockedDateInput.value;
                if (!val) return;
                
                let dates = [];
                if (val.includes(' to ')) {
                    const parts = val.split(' to ');
                    const startStr = parts[0];
                    const endStr = parts[1] || parts[0];
                    
                    let currentDate = new Date(startStr);
                    const endDate = new Date(endStr);
                    
                    // Prevent infinite loops if parsing fails
                    let safeGuard = 0;
                    while (currentDate <= endDate && safeGuard < 365) {
                        dates.push(currentDate.toISOString().split('T')[0]);
                        currentDate.setDate(currentDate.getDate() + 1);
                        safeGuard++;
                    }
                } else if (val.includes(',')) {
                    dates = val.split(',').map(d => d.trim()).filter(d => d);
                } else {
                    dates = [val.trim()];
                }

                if (dates.length === 0) return;

                try {
                    addBlockedDateBtn.textContent = 'Checking...';
                    addBlockedDateBtn.disabled = true;

                    const res = await window.apiFetch('api/bookings.php');
                    const text = await res.text();
                    const data = JSON.parse(text);

                    let bookingCount = 0;
                    if (data.status === 'success' && data.data) {
                        const upcomingBookings = data.data.filter(b => dates.includes(b.booking_date) && b.status === 'upcoming');
                        bookingCount = upcomingBookings.length;
                    }

                    if (bookingCount > 0) {
                        const msg = `Cannot block: There are ${bookingCount} active booking(s) on the selected dates. Please cancel or reschedule them first.`;
                        window.showToaster ? window.showToaster(msg, true) : alert(msg);
                        
                        addBlockedDateBtn.textContent = 'Add Date';
                        addBlockedDateBtn.disabled = false;
                        return; // Block rejection
                    }
                } catch (e) {
                    console.warn('Could not check for existing bookings', e);
                }

                addBlockedDateBtn.textContent = 'Add Date';
                addBlockedDateBtn.disabled = false;

                dates.forEach(dateStr => {
                    addBlockedDateToUI(dateStr);
                });
                
                newBlockedDateInput.value = '';
                if (newBlockedDateInput._flatpickr) {
                    newBlockedDateInput._flatpickr.clear();
                }
            });
        }
    }
});