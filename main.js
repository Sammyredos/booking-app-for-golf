
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

document.addEventListener('DOMContentLoaded', async () => {
    // Global Settings
    window.SMJ_SETTINGS = {};
    try {
        const res = await window.apiFetch('api/settings.php');
        const text = await res.text();
        const data = JSON.parse(text);
        if (data.status === 'success' && data.data) {
            window.SMJ_SETTINGS = data.data;
        }
    } catch(e) {
        console.warn('Could not load global settings', e);
    }

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Simple interaction for the scroll indicator
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 100) {
                scrollIndicator.style.opacity = '0';
                scrollIndicator.style.transition = 'opacity 0.3s ease';
            } else {
                scrollIndicator.style.opacity = '1';
            }
        });
    }

    // Coach Modal Logic
    const coachModalOverlay = document.getElementById('coachModalOverlay');
    const meetCoachBtns = document.querySelectorAll('.meet-coach-trigger');
    const coachModalClose = document.getElementById('coachModalClose');

    if (coachModalOverlay && meetCoachBtns.length > 0 && coachModalClose) {
        meetCoachBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                coachModalOverlay.classList.add('show');
            });
        });

        coachModalClose.addEventListener('click', () => {
            coachModalOverlay.classList.remove('show');
        });

        coachModalOverlay.addEventListener('click', (e) => {
            if (e.target === coachModalOverlay) {
                coachModalOverlay.classList.remove('show');
            }
        });
    }

    // Modal Logic
    const bookingModal = document.getElementById('bookingModal');
    const bookBtns = document.querySelectorAll('.book-btn');
    const closeModalBtn = document.getElementById('closeModal');
    
    const step1 = document.getElementById('step1');
    const step2Newbie = document.getElementById('step2-newbie');
    const step1RegularType = document.getElementById('step1-regular-type');
    const step2Regular = document.getElementById('step2-regular');
    
    const btnNewbie = document.getElementById('btnNewbie');
    const btnRegular = document.getElementById('btnRegular');
    const btnKids = document.getElementById('btnKids');
    const btnOneTime = document.getElementById('btnOneTime');
    const btnMonthly = document.getElementById('btnMonthly');
    
    const backToStep1 = document.getElementById('backToStep1');
    const backToStep1FromType = document.getElementById('backToStep1-from-type');
    const backToStep1Regular = document.getElementById('backToStep1-regular');
    const backToStep1Kids = document.getElementById('backToStep1-kids');
    const step2Kids = document.getElementById('step2-kids');
    const step1KidsType = document.getElementById('step1-kids-type');
    const btnKidsOneTime = document.getElementById('btnKidsOneTime');
    const btnKidsMonthly = document.getElementById('btnKidsMonthly');
    const backToStep1FromKidsType = document.getElementById('backToStep1-from-kids-type');
    
    const step2bNewbieSession = document.getElementById('step2b-newbie-session');
    const step2bKidsSession = document.getElementById('step2b-kids-session');
    const step2bAdvancedSession = document.getElementById('step2b-advanced-session');
    const step3Booking = document.getElementById('step3-booking');
    const backToStep2 = document.getElementById('backToStep2');
    const backToStep25FromNewbie = document.getElementById('backToStep25FromNewbie');
    const backToStep25FromKids = document.getElementById('backToStep25FromKids');
    const backToStep25FromAdvanced = document.getElementById('backToStep25FromAdvanced');

    const step25Payment = document.getElementById('step2.5-payment');
    const backToStep2FromPayment = document.getElementById('backToStep2FromPayment');
    const cashPaymentLabel = document.getElementById('cashPaymentLabel');
    const paystackPaymentLabel = document.getElementById('paystackPaymentLabel');
    const continueToScheduling = document.getElementById('continueToScheduling');
    let selectedPaymentMethod = null;

    if (bookingModal) {
        // Open Modal
        bookBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                bookingModal.classList.add('active');
            });
        });

        // Close Modal and Reset
        closeModalBtn.addEventListener('click', () => {
            bookingModal.classList.remove('active');
            setTimeout(() => {
                step2Newbie.style.display = 'none';
                step1RegularType.style.display = 'none';
                step2Regular.style.display = 'none';
                if (step1KidsType) step1KidsType.style.display = 'none';
                if (step2Kids) step2Kids.style.display = 'none';
                if (step25Payment) step25Payment.style.display = 'none';
                if (step2bKidsSession) step2bKidsSession.style.display = 'none';
                if (step2bAdvancedSession) step2bAdvancedSession.style.display = 'none';
                if (step3Booking) step3Booking.style.display = 'none';
                step1.style.display = 'block';
                document.querySelector('.modal-content').classList.remove('modal-regular-wide');
                
                // reset payment selection
                if (cashPaymentLabel) {
                    cashPaymentLabel.style.borderColor = '#e5e7eb';
                    cashPaymentLabel.style.background = 'transparent';
                }
                if (continueToScheduling) continueToScheduling.disabled = true;
                selectedPaymentMethod = null;
            }, 300); // Reset after fade out
        });

        // Newbie Selection
        btnNewbie.addEventListener('click', () => {
            btnNewbie.classList.add('selected');
            btnRegular.classList.remove('selected');
            if (btnKids) btnKids.classList.remove('selected');
            step1.style.display = 'none';
            step2Newbie.style.display = 'block';
        });

        // Regular Golfer Selection (Goes to type selection)
        btnRegular.addEventListener('click', () => {
            btnRegular.classList.add('selected');
            btnNewbie.classList.remove('selected');
            if (btnKids) btnKids.classList.remove('selected');
            step1.style.display = 'none';
            step1RegularType.style.display = 'block';
        });

        // Kids Selection
        if (btnKids) {
            btnKids.addEventListener('click', () => {
                btnKids.classList.add('selected');
                btnNewbie.classList.remove('selected');
                btnRegular.classList.remove('selected');
                step1.style.display = 'none';
                if (step1KidsType) {
                    step1KidsType.style.display = 'block';
                }
            });
        }

        // Kids Booking Type Selection
        const showKidsPlans = (type, title) => {
            const headerTitle = step2Kids.querySelector('.modal-header h3');
            if (headerTitle) headerTitle.textContent = title;
            
            const plans = step2Kids.querySelectorAll('.regular-plan');
            plans.forEach(plan => {
                if (plan.getAttribute('data-type') === type) {
                    plan.style.display = 'flex';
                } else {
                    plan.style.display = 'none';
                }
            });

            step1KidsType.style.display = 'none';
            step2Kids.style.display = 'block';
            document.querySelector('.modal-content').classList.add('modal-regular-wide');
        };

        if (btnKidsOneTime) btnKidsOneTime.addEventListener('click', () => showKidsPlans('onetime', 'KIDS ONE TIME PLANS'));
        if (btnKidsMonthly) btnKidsMonthly.addEventListener('click', () => showKidsPlans('monthly', 'KIDS MONTHLY PLANS'));

        // Booking Type Selection (Goes to plans)
        const showRegularPlans = (type, title) => {
            // Update title
            const headerTitle = step2Regular.querySelector('.modal-header h3');
            if (headerTitle) headerTitle.textContent = title;
            
            // Filter plans
            const plans = step2Regular.querySelectorAll('.regular-plan');
            plans.forEach(plan => {
                if (plan.getAttribute('data-type') === type) {
                    plan.style.display = 'flex';
                } else {
                    plan.style.display = 'none';
                }
            });

            step1RegularType.style.display = 'none';
            step2Regular.style.display = 'block';
            document.querySelector('.modal-content').classList.add('modal-regular-wide');
        };

        btnOneTime.addEventListener('click', () => showRegularPlans('onetime', 'ONE TIME BOOKING PLANS'));
        btnMonthly.addEventListener('click', () => showRegularPlans('monthly', 'MONTHLY SUBSCRIPTION PLANS'));

        // Back Buttons
        backToStep1.addEventListener('click', () => {
            step2Newbie.style.display = 'none';
            step1.style.display = 'block';
        });

        if (backToStep1FromKidsType) {
            backToStep1FromKidsType.addEventListener('click', () => {
                if (step1KidsType) step1KidsType.style.display = 'none';
                step1.style.display = 'block';
            });
        }

        if (backToStep1Kids) {
            backToStep1Kids.addEventListener('click', () => {
                if (step2Kids) step2Kids.style.display = 'none';
                if (step1KidsType) step1KidsType.style.display = 'block';
                document.querySelector('.modal-content').classList.remove('modal-regular-wide');
            });
        }

        backToStep1FromType.addEventListener('click', () => {
            step1RegularType.style.display = 'none';
            step1.style.display = 'block';
        });

        backToStep1Regular.addEventListener('click', () => {
            step2Regular.style.display = 'none';
            step1RegularType.style.display = 'block';
            document.querySelector('.modal-content').classList.remove('modal-regular-wide');
        });
        
        // Payment step setup
        const handlePaymentSelection = (method, labelEl) => {
            const radio = labelEl.querySelector('input[type="radio"]');
            if (radio && !radio.disabled) {
                radio.checked = true;
                selectedPaymentMethod = method;
                
                // Reset styles
                if (cashPaymentLabel) {
                    cashPaymentLabel.style.borderColor = '#e5e7eb';
                    cashPaymentLabel.style.background = 'transparent';
                }
                if (paystackPaymentLabel) {
                    paystackPaymentLabel.style.borderColor = '#e5e7eb';
                    paystackPaymentLabel.style.background = 'transparent';
                }

                labelEl.style.borderColor = 'var(--text-dark)';
                labelEl.style.background = 'var(--accent)'; // lime green active state
                
                // Proceed directly
                proceedFromPayment();
            }
        };

        const proceedFromPayment = () => {
            if (selectedPaymentMethod) {
                if (step25Payment) step25Payment.style.display = 'none';

                if (btnNewbie && btnNewbie.classList.contains('selected')) {
                    const currentPlanTitle = document.getElementById('bookingPlanTitle').textContent || "Newbie";
                    
                    if (step2bNewbieSession) {
                        const pTag = step2bNewbieSession.querySelector('.modal-header p');
                        if (pTag) pTag.textContent = `What type of lesson would you like to book for your ${currentPlanTitle} plan today?`;
                        step2bNewbieSession.style.display = 'block';
                    }
                    
                    // Add listeners to newbie session buttons
                    if (step2bNewbieSession) {
                        const sessionBtns = step2bNewbieSession.querySelectorAll('.newbie-session-btn');
                        sessionBtns.forEach(btn => {
                            // avoid multiple listeners
                            btn.replaceWith(btn.cloneNode(true));
                        });
                        
                        step2bNewbieSession.querySelectorAll('.newbie-session-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const selectedBtn = e.currentTarget;
                                const title = selectedBtn.dataset.title;
                                const duration = selectedBtn.dataset.duration;

                                // Proceed to step 3
                                step2bNewbieSession.style.display = 'none';
                                const titleEl = document.getElementById('bookingPlanTitle');
                                if (titleEl) titleEl.textContent = title;
                                const durationEl = document.getElementById('bookingPlanDuration');
                                if (durationEl) durationEl.textContent = duration;
                                
                                if (step3Booking) step3Booking.style.display = 'block';
                                document.querySelector('.modal-content').classList.add('modal-regular-wide');
                                if (typeof window.initCalendar === 'function') {
                                    window.initCalendar();
                                }
                            });
                        });
                    }
                } else if (btnKids && btnKids.classList.contains('selected')) {
                    const currentPlanTitle = document.getElementById('bookingPlanTitle').textContent || "Kids";
                    
                    if (step2bKidsSession) {
                        const pTag = step2bKidsSession.querySelector('.modal-header p');
                        if (pTag) pTag.textContent = `What type of lesson would you like to book for your child's ${currentPlanTitle} plan today?`;
                        step2bKidsSession.style.display = 'block';
                    }
                    
                    // Add listeners to kids session buttons
                    if (step2bKidsSession) {
                        const sessionBtns = step2bKidsSession.querySelectorAll('.kids-session-btn');
                        sessionBtns.forEach(btn => {
                            btn.replaceWith(btn.cloneNode(true));
                        });
                        
                        step2bKidsSession.querySelectorAll('.kids-session-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                const selectedBtn = e.currentTarget;
                                const title = selectedBtn.dataset.title;
                                const duration = selectedBtn.dataset.duration;

                                // Proceed to step 3
                                step2bKidsSession.style.display = 'none';
                                const titleEl = document.getElementById('bookingPlanTitle');
                                if (titleEl) titleEl.textContent = title;
                                const durationEl = document.getElementById('bookingPlanDuration');
                                if (durationEl) durationEl.textContent = duration;
                                
                                if (step3Booking) step3Booking.style.display = 'block';
                                document.querySelector('.modal-content').classList.add('modal-regular-wide');
                                if (typeof window.initCalendar === 'function') {
                                    window.initCalendar();
                                }
                            });
                        });
                    }
                } else {
                    const currentPlanTitle = document.getElementById('bookingPlanTitle').textContent || "";
                    if (currentPlanTitle.toLowerCase().includes('drill')) {
                        if (step2bAdvancedSession) {
                            const pTag = step2bAdvancedSession.querySelector('.modal-header p');
                            if (pTag) pTag.textContent = `What type of lesson would you like to book for your Drill plan today?`;
                            step2bAdvancedSession.style.display = 'block';
                        }
                        
                        if (step2bAdvancedSession) {
                            const sessionBtns = step2bAdvancedSession.querySelectorAll('.advanced-session-btn');
                            sessionBtns.forEach(btn => {
                                btn.replaceWith(btn.cloneNode(true));
                            });
                            
                            step2bAdvancedSession.querySelectorAll('.advanced-session-btn').forEach(btn => {
                                btn.addEventListener('click', (e) => {
                                    const selectedBtn = e.currentTarget;
                                    const title = selectedBtn.dataset.title;
                                    const duration = selectedBtn.dataset.duration;

                                    step2bAdvancedSession.style.display = 'none';
                                    const titleEl = document.getElementById('bookingPlanTitle');
                                    if (titleEl) titleEl.textContent = title;
                                    const durationEl = document.getElementById('bookingPlanDuration');
                                    if (durationEl) durationEl.textContent = duration;
                                    
                                    if (step3Booking) step3Booking.style.display = 'block';
                                    document.querySelector('.modal-content').classList.add('modal-regular-wide');
                                    if (typeof window.initCalendar === 'function') {
                                        window.initCalendar();
                                    }
                                });
                            });
                        }
                    } else {
                        // Regular flow
                        if (step3Booking) step3Booking.style.display = 'block';
                        document.querySelector('.modal-content').classList.add('modal-regular-wide');
                        if (typeof window.initCalendar === 'function') {
                            window.initCalendar();
                        }
                    }
                }
            }
        };

        if (cashPaymentLabel) {
            cashPaymentLabel.addEventListener('click', () => handlePaymentSelection('cash', cashPaymentLabel));
        }
        
        if (paystackPaymentLabel) {
            paystackPaymentLabel.addEventListener('click', () => handlePaymentSelection('paystack', paystackPaymentLabel));
        }



        if (backToStep2FromPayment) {
            backToStep2FromPayment.addEventListener('click', () => {
                if (step25Payment) step25Payment.style.display = 'none';
                if (btnNewbie && btnNewbie.classList.contains('selected')) {
                    if (step2Newbie) step2Newbie.style.display = 'block';
                } else if (btnKids && btnKids.classList.contains('selected')) {
                    if (step2Kids) step2Kids.style.display = 'block';
                    document.querySelector('.modal-content').classList.add('modal-regular-wide');
                } else {
                    if (step2Regular) step2Regular.style.display = 'block';
                    document.querySelector('.modal-content').classList.add('modal-regular-wide');
                }
            });
        }

        if (backToStep2) {
            backToStep2.addEventListener('click', () => {
                if (step3Booking) step3Booking.style.display = 'none';
                document.querySelector('.modal-content').classList.remove('modal-regular-wide');
                
                if (btnNewbie && btnNewbie.classList.contains('selected')) {
                    if (step2bNewbieSession) step2bNewbieSession.style.display = 'block';
                } else if (btnKids && btnKids.classList.contains('selected')) {
                    if (step2bKidsSession) step2bKidsSession.style.display = 'block';
                } else {
                    const currentPlanTitle = document.getElementById('bookingPlanTitle') ? document.getElementById('bookingPlanTitle').textContent : "";
                    if (currentPlanTitle.toLowerCase().includes('drill')) {
                        if (step2bAdvancedSession) step2bAdvancedSession.style.display = 'block';
                    } else {
                        if (step25Payment) step25Payment.style.display = 'block';
                    }
                }
            });
        }
        
        if (backToStep25FromNewbie) {
            backToStep25FromNewbie.addEventListener('click', () => {
                if (step2bNewbieSession) step2bNewbieSession.style.display = 'none';
                if (step25Payment) step25Payment.style.display = 'block';
            });
        }
        
        if (backToStep25FromKids) {
            backToStep25FromKids.addEventListener('click', () => {
                if (step2bKidsSession) step2bKidsSession.style.display = 'none';
                if (step25Payment) step25Payment.style.display = 'block';
            });
        }
        
        if (backToStep25FromAdvanced) {
            backToStep25FromAdvanced.addEventListener('click', () => {
                if (step2bAdvancedSession) step2bAdvancedSession.style.display = 'none';
                if (step25Payment) step25Payment.style.display = 'block';
            });
        }
        
        // Fetch and Render Dynamic Plans
        async function fetchAndRenderPlans() {
            let plans = [];
            try {
                const res = await window.apiFetch('api/plans.php');
                const text = await res.text();
                const data = JSON.parse(text);
                if (data.status === 'success') {
                    plans = data.data;
                } else {
                    plans = JSON.parse(localStorage.getItem('smj_local_plans') || '[]');
                }
            } catch(e) {
                plans = JSON.parse(localStorage.getItem('smj_local_plans') || '[]');
            }
            
            let userLimits = {};
            if (window.Clerk && window.Clerk.user) {
                const isAdmin = window.Clerk.user.publicMetadata && window.Clerk.user.publicMetadata.role === 'admin';
                if (!isAdmin) {
                    try {
                        const lRes = await window.apiFetch(`api/user_limits.php?user_id=${window.Clerk.user.id}`);
                        const lData = await lRes.json();
                        if (lData.status === 'success') {
                            userLimits = lData.data;
                        }
                    } catch(e) {}
                }
            }

            const newbieContainer = document.getElementById('newbiePlansContainer');
            const regularContainer = document.getElementById('regularPlansContainer');
            const kidsContainer = document.getElementById('kidsPlansContainer');
            const newbieSessionOptions = document.getElementById('newbieSessionOptions');
            const newbieSessionOptionsLessons = document.getElementById('newbieSessionOptionsLessons');
            const advancedSessionOptions = document.getElementById('advancedSessionOptions');
            const advancedSessionOptionsLessons = document.getElementById('advancedSessionOptionsLessons');
            
            if (newbieContainer) newbieContainer.innerHTML = '';
            if (regularContainer) regularContainer.innerHTML = '';
            if (kidsContainer) kidsContainer.innerHTML = '';
            if (newbieSessionOptions) newbieSessionOptions.innerHTML = '';
            if (newbieSessionOptionsLessons) newbieSessionOptionsLessons.innerHTML = '';
            if (advancedSessionOptions) advancedSessionOptions.innerHTML = '';
            if (advancedSessionOptionsLessons) advancedSessionOptionsLessons.innerHTML = '';

            plans.forEach(p => {
                const isPremium = p.is_premium;
                const type = p.category;

                let featuresHtml = '';
                if (Array.isArray(p.features)) {
                    p.features.forEach(f => {
                        featuresHtml += `
                        <li>
                            <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span>${f}</span>
                        </li>`;
                    });
                }

                if (type === 'newbie_session') {
                    let iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'; // default clock/range
                    
                    if (p.title.toLowerCase().includes('9 holes')) {
                        iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>'; // flag/hole
                    } else if (p.title.toLowerCase().includes('18 holes')) {
                        iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'; // star/trophy
                    }

                    const isLimited = userLimits[p.title] && userLimits[p.title].limit_reached;
                    const limitText = isLimited ? `<div style="color:var(--danger); font-size:0.75rem; margin-top:0.25rem;">Limit Reached</div>` : '';

                    const sessionBtn = `
                        <button class="level-card newbie-session-btn" data-title="${p.title}" data-duration="${p.duration}" ${isLimited ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
                            <div class="level-icon">
                                ${iconHtml}
                            </div>
                            <h4>${p.title}</h4>
                            <p>${p.duration}</p>
                            ${limitText}
                        </button>
                    `;
                    if (newbieSessionOptions) newbieSessionOptions.innerHTML += sessionBtn;
                    if (newbieSessionOptionsLessons) newbieSessionOptionsLessons.innerHTML += sessionBtn;
                    return; // Don't render as a regular plan card
                }

                if (type === 'kids_session') {
                    let iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'; // default clock/range
                    
                    const isLimited = userLimits[p.title] && userLimits[p.title].limit_reached;
                    const limitText = isLimited ? `<div style="color:var(--danger); font-size:0.75rem; margin-top:0.25rem;">Limit Reached</div>` : '';

                    const sessionBtn = `
                        <button class="level-card kids-session-btn" data-title="${p.title}" data-duration="${p.duration}" ${isLimited ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
                            <div class="level-icon">
                                ${iconHtml}
                            </div>
                            <h4>${p.title}</h4>
                            <p>${p.duration}</p>
                            ${limitText}
                        </button>
                    `;
                    const kidsSessionOptions = document.getElementById('kidsSessionOptions');
                    const kidsSessionOptionsLessons = document.getElementById('kidsSessionOptionsLessons');
                    if (kidsSessionOptions) kidsSessionOptions.innerHTML += sessionBtn;
                    if (kidsSessionOptionsLessons) kidsSessionOptionsLessons.innerHTML += sessionBtn;
                    return; // Don't render as a regular plan card
                }

                if (type === 'advanced_session') {
                    let iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'; // default clock/range
                    if (p.title.toLowerCase().includes('9 holes')) {
                        iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>'; // flag/hole
                    } else if (p.title.toLowerCase().includes('18 holes')) {
                        iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'; // star/trophy
                    }
                    
                    const isLimited = userLimits[p.title] && userLimits[p.title].limit_reached;
                    const limitText = isLimited ? `<div style="color:var(--danger); font-size:0.75rem; margin-top:0.25rem;">Limit Reached</div>` : '';

                    const sessionBtn = `
                        <button class="level-card advanced-session-btn" data-title="${p.title}" data-duration="${p.duration}" ${isLimited ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
                            <div class="level-icon">
                                ${iconHtml}
                            </div>
                            <h4>${p.title}</h4>
                            <p>${p.duration}</p>
                            ${limitText}
                        </button>
                    `;
                    const advancedSessionOptions = document.getElementById('advancedSessionOptions');
                    const advancedSessionOptionsLessons = document.getElementById('advancedSessionOptionsLessons');
                    if (advancedSessionOptions) advancedSessionOptions.innerHTML += sessionBtn;
                    if (advancedSessionOptionsLessons) advancedSessionOptionsLessons.innerHTML += sessionBtn;
                    return; // Don't render as a regular plan card
                }

                const isLimited = userLimits[p.title] && userLimits[p.title].limit_reached;
                const btnText = isLimited ? 'Limit Reached' : 'Book Now';
                const btnDisabled = isLimited ? 'disabled style="background:var(--bg-gray); color:var(--text-gray); cursor:not-allowed; border-color:var(--border-color);"' : '';

                const cardHtml = `
                    <div class="plan-card ${isPremium ? 'premium-card' : ''} ${type !== 'newbie' ? 'regular-plan' : ''}" data-type="${type !== 'newbie' ? type : ''}">
                        ${isPremium ? `<div class="popular-badge">${p.category === 'monthly' && p.title.toLowerCase().includes('kids') ? 'Kids' : 'Premium'}</div>` : ''}
                        <div class="plan-header">
                            <h4>${p.title}</h4>
                            <div class="plan-price">₦${Number(p.price).toLocaleString()}</div>
                            <div class="plan-duration">${p.duration}</div>
                        </div>
                        <div class="plan-divider"></div>
                        <ul class="plan-features">
                            ${featuresHtml}
                        </ul>
                        <button class="btn btn-primary plan-btn" ${btnDisabled}>${btnText}</button>
                    </div>
                `;

                const isKids = p.title.toLowerCase().includes('kids');

                if (type === 'newbie' && newbieContainer) {
                    newbieContainer.innerHTML += cardHtml;
                } else if (isKids && kidsContainer) {
                    kidsContainer.innerHTML += cardHtml;
                } else if ((type === 'onetime' || type === 'monthly') && !isKids && regularContainer) {
                    regularContainer.innerHTML += cardHtml;
                }
            });

            // Re-attach plan button listeners after rendering
            attachPlanListeners();
        }

        function attachPlanListeners() {
            const planBtns = document.querySelectorAll('.plan-btn');
            planBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const planCard = btn.closest('.plan-card');
                    const title = planCard.querySelector('h4').textContent;
                    const price = planCard.querySelector('.plan-price').textContent;
                    const duration = planCard.querySelector('.plan-duration').textContent;
                    const perks = Array.from(planCard.querySelectorAll('li span')).map(span => span.textContent).join(' | ');

                    // Populate step3-booking details
                    const titleEl = document.getElementById('bookingPlanTitle');
                    if (titleEl) titleEl.textContent = title;
                    const priceEl = document.getElementById('bookingPlanPrice');
                    if (priceEl) priceEl.textContent = price;
                    const durationEl = document.getElementById('bookingPlanDuration');
                    if (durationEl) durationEl.textContent = duration;
                    const perksEl = document.getElementById('bookingPlanPerks');
                    if (perksEl) perksEl.textContent = perks;

                    // AUTH CHECK
                    if (!window.Clerk || !window.Clerk.user) {
                        // User is not logged in
                        let category = 'regular';
                        if (btnNewbie && btnNewbie.classList.contains('selected')) category = 'newbie';
                        if (btnKids && btnKids.classList.contains('selected')) category = 'kids';
                        
                        const pendingBooking = { title, price, duration, perks, category };
                        localStorage.setItem('smj_pending_booking', JSON.stringify(pendingBooking));
                        
                        window.location.href = 'auth.html';
                        return;
                    }

                    // Check payment settings
                    const s = window.SMJ_SETTINGS || {};
                    const paystackEnabled = s.paystack_enabled === 'true';
                    const cashEnabled = s.cash_enabled === 'true';

                    // Update UI for Payment Methods
                    if (paystackPaymentLabel) {
                        const radio = paystackPaymentLabel.querySelector('input');
                        const statusTxt = paystackPaymentLabel.querySelector('.paystack-status-text');
                        if (!paystackEnabled) {
                            paystackPaymentLabel.classList.add('disabled');
                            paystackPaymentLabel.style.cursor = 'not-allowed';
                            paystackPaymentLabel.style.opacity = '0.6';
                            if (radio) radio.disabled = true;
                            if (statusTxt) statusTxt.textContent = 'Currently Disabled';
                        } else {
                            paystackPaymentLabel.classList.remove('disabled');
                            paystackPaymentLabel.style.cursor = 'pointer';
                            paystackPaymentLabel.style.opacity = '1';
                            if (radio) radio.disabled = false;
                            if (statusTxt) statusTxt.textContent = 'Pay securely online';
                        }
                    }

                    if (cashPaymentLabel) {
                        const radio = cashPaymentLabel.querySelector('input');
                        if (!cashEnabled) {
                            cashPaymentLabel.classList.add('disabled');
                            cashPaymentLabel.style.cursor = 'not-allowed';
                            cashPaymentLabel.style.opacity = '0.6';
                            if (radio) radio.disabled = true;
                        } else {
                            cashPaymentLabel.classList.remove('disabled');
                            cashPaymentLabel.style.cursor = 'pointer';
                            cashPaymentLabel.style.opacity = '1';
                            if (radio) radio.disabled = false;
                        }
                    }

                    // Bypass if both are disabled
                    step2Regular.style.display = 'none';
                    step2Newbie.style.display = 'none';
                    if (step2Kids) step2Kids.style.display = 'none';
                    document.querySelector('.modal-content').classList.remove('modal-regular-wide');

                    if (!paystackEnabled && !cashEnabled) {
                        selectedPaymentMethod = 'none'; // bypass
                        proceedFromPayment();
                    } else {
                        if (step25Payment) step25Payment.style.display = 'block';
                    }
                    
                    // Hide Continue Button for Newbie
                    if (btnNewbie && btnNewbie.classList.contains('selected')) {
                        if (continueToScheduling) continueToScheduling.parentElement.style.display = 'none';
                    } else {
                        if (continueToScheduling) continueToScheduling.parentElement.style.display = 'flex';
                    }
                });
            });
        }

        fetchAndRenderPlans();
    }

    // Calendar & Booking Logic
    let selectedDate = null;
    let selectedTime = null;
    
    function initCalendar() {
        const calGrid = document.getElementById('calendarGrid');
        const monthYearTxt = document.getElementById('currentMonthYear');
        if (!calGrid) return;
        
        let currentDate = new Date(); // Start with current month
        
        function renderMonth(date) {
            // Clear existing days but keep headers
            const headers = Array.from(calGrid.querySelectorAll('.cal-day-header'));
            calGrid.innerHTML = '';
            headers.forEach(h => calGrid.appendChild(h));
            
            const year = date.getFullYear();
            const month = date.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            monthYearTxt.textContent = date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
            
            // Empty slots for days before first day of month
            for (let i = 0; i < firstDay; i++) {
                const empty = document.createElement('div');
                calGrid.appendChild(empty);
            }
            
            const today = new Date();
            today.setHours(0,0,0,0);
            
            for (let i = 1; i <= daysInMonth; i++) {
                const dayBtn = document.createElement('button');
                dayBtn.className = 'cal-date-btn';
                dayBtn.textContent = i;
                
                const thisDate = new Date(year, month, i);
                
                // Get settings for enforcement
                const s = window.SMJ_SETTINGS || {};
                const workingDays = s.working_days ? s.working_days.split(',') : ['1','2','3','4','5','6'];
                const blockedDates = s.blocked_dates ? s.blocked_dates.split(',').map(d=>d.trim()) : [];
                
                const y = thisDate.getFullYear();
                const m = String(thisDate.getMonth() + 1).padStart(2, '0');
                const d = String(thisDate.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;
                
                const dayOfWeek = thisDate.getDay().toString();
                
                if (thisDate < today || !workingDays.includes(dayOfWeek) || blockedDates.includes(dateStr)) {
                    dayBtn.disabled = true;
                } else {
                    dayBtn.onclick = () => {
                        // Remove active class from all
                        calGrid.querySelectorAll('.cal-date-btn').forEach(b => b.classList.remove('active'));
                        dayBtn.classList.add('active');
                        selectedDate = thisDate;
                        selectedTime = null; // Reset time
                        
                        document.getElementById('selectedDateText').textContent = thisDate.toLocaleDateString('default', { weekday: 'long', day: 'numeric', month: 'long' });
                        renderTimeSlots();
                        
                        // Auto-scroll to time slots on mobile and tablet
                        if (window.innerWidth <= 1024) {
                            setTimeout(() => {
                                const timeSlotContainer = document.querySelector('.booking-timeslot-sidebar');
                                if (timeSlotContainer) {
                                    timeSlotContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                            }, 100);
                        }
                    };
                }
                
                calGrid.appendChild(dayBtn);
            }
        }
        
        document.getElementById('prevMonth').onclick = () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderMonth(currentDate);
        };
        document.getElementById('nextMonth').onclick = () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderMonth(currentDate);
        };
        
        renderMonth(currentDate);
        
        // Reset selections
        selectedDate = null;
        selectedTime = null;
        document.getElementById('selectedDateText').textContent = 'Select a date';
        document.getElementById('timeslotList').innerHTML = '<div style="color: var(--text-gray); font-size: 0.85rem; padding: 1rem 0;">Please select a date first.</div>';
        document.getElementById('confirmBookingBtn').style.display = 'none';
    }
    
    // Expose initCalendar globally for lessons.js to call
    window.initCalendar = initCalendar;
    
    function parseDurationMins(planName) {
        if (!planName) return 60;
        planName = planName.toLowerCase();
        if (planName.includes('nine holes') || planName.includes('9 holes')) return 150; // 2.5 hours
        if (planName.includes('18 holes')) return 300; // 5 hours (matches UI 300 mins)
        if (planName.includes('outside ikoyi')) return 1440; // 24 hours (Full Day)
        if (planName.includes('simulator')) return 120; // Match admin.js and bookings.php
        return 60; // Default 1 hour
    }

    function timeToMins(timeStr) {
        const [time, mod] = timeStr.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (mod === 'PM' && h !== 12) h += 12;
        if (mod === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    }

    async function renderTimeSlots() {
        const timeList = document.getElementById('timeslotList');
        const confirmBtn = document.getElementById('confirmBookingBtn');
        
        timeList.innerHTML = '<div style="color:var(--text-gray); padding:1rem 0;">Checking availability...</div>';
        confirmBtn.style.display = 'none';

        let existingBookings = [];
        try {
            const res = await window.apiFetch('api/bookings.php');
            const text = await res.text();
            try {
                const data = JSON.parse(text);
                if (data.status === 'success') {
                    existingBookings = data.data;
                }
            } catch(e) {
                existingBookings = JSON.parse(localStorage.getItem('smj_local_bookings') || '[]');
            }
        } catch(err) {
            existingBookings = JSON.parse(localStorage.getItem('smj_local_bookings') || '[]');
        }

        const selectedDateStr = new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const todaysBookings = existingBookings.filter(b => b.booking_date === selectedDateStr && b.status !== 'cancelled');

        let bufferBefore = 10;
        let bufferAfter = 10;
        let STANDARD_SLOTS = [9*60, 9*60+30, 10*60, 10*60+30, 11*60, 11*60+30, 12*60, 12*60+30, 13*60, 13*60+30, 14*60, 14*60+30, 15*60, 15*60+30, 16*60];
        let schedStartMins = 9 * 60;
        let schedEndMins = 16 * 60;

        try {
            const setRes = await window.apiFetch('api/settings.php');
            const setText = await setRes.text();
            const setData = JSON.parse(setText);
            if (setData.status === 'success' && setData.data) {
                if (setData.data.schedule_start) {
                    const [h, m] = setData.data.schedule_start.split(':').map(Number);
                    schedStartMins = h * 60 + m;
                }
                if (setData.data.schedule_end) {
                    const [h, m] = setData.data.schedule_end.split(':').map(Number);
                    schedEndMins = h * 60 + m;
                }
                if (setData.data.buffer_before !== undefined) {
                    bufferBefore = parseInt(setData.data.buffer_before, 10);
                }
                if (setData.data.buffer_after !== undefined) {
                    bufferAfter = parseInt(setData.data.buffer_after, 10);
                }
                STANDARD_SLOTS = [];
                for (let curr = schedStartMins; curr <= schedEndMins; curr += 30) {
                    STANDARD_SLOTS.push(curr);
                }
            }
        } catch(e) {
            console.warn('Could not load dynamic schedule, using defaults');
        }
        
        const currentPlanName = document.getElementById('bookingPlanTitle') ? document.getElementById('bookingPlanTitle').textContent : '';
        const currentPlanDuration = parseDurationMins(currentPlanName);
        const requiredMins = currentPlanDuration;
        const isCandidateFullDay = (currentPlanDuration >= 1440);
        const hasExistingFullDay = todaysBookings.some(b => parseDurationMins(b.plan_name) >= 1440);

        const blockedRanges = [];
        if ((isCandidateFullDay && todaysBookings.length > 0) || hasExistingFullDay) {
            blockedRanges.push({ start: -9999, end: 9999 });
        } else {
            todaysBookings.forEach(b => {
                const startMins = timeToMins(b.booking_time);
                const durationMins = parseDurationMins(b.plan_name);
                blockedRanges.push({ start: startMins - bufferBefore, end: startMins + durationMins + bufferAfter });
            });
        }

        let allCandidates = [...STANDARD_SLOTS];

        blockedRanges.forEach(range => {
            // range.start is already E_start - bufferBefore
            // range.end is already E_end + bufferAfter
            
            // The exact slot AFTER this booking:
            // C_start - bufferBefore = range.end  =>  C_start = range.end + bufferBefore
            let afterCandidate = range.end + bufferBefore;
            if (afterCandidate >= schedStartMins && afterCandidate <= schedEndMins && !allCandidates.includes(afterCandidate)) {
                allCandidates.push(afterCandidate);
            }
            
            // The exact slot BEFORE this booking:
            // C_end + bufferAfter = range.start  =>  C_start + duration + bufferAfter = range.start
            // C_start = range.start - requiredMins - bufferAfter
            let beforeCandidate = range.start - requiredMins - bufferAfter;
            if (beforeCandidate >= schedStartMins && beforeCandidate <= schedEndMins && !allCandidates.includes(beforeCandidate)) {
                allCandidates.push(beforeCandidate);
            }
        });

        allCandidates.sort((a, b) => a - b);


        timeList.innerHTML = '';
        let hasAvailableSlots = false;
        
        const now = new Date();
        const isToday = selectedDate.getFullYear() === now.getFullYear() && 
                        selectedDate.getMonth() === now.getMonth() && 
                        selectedDate.getDate() === now.getDate();
        const currentMins = now.getHours() * 60 + now.getMinutes();

        allCandidates.forEach(slotStart => {
            const slotEnd = slotStart + requiredMins;
            const cStart = slotStart - bufferBefore;
            const cEnd = slotEnd + bufferAfter;
            
            let isBlocked = false;
            
            // Block if the slot has already passed today
            if (isToday && slotStart <= currentMins) {
                isBlocked = true;
            }

            if (!isBlocked) {
                for (let range of blockedRanges) {
                    if (cStart < range.end && cEnd > range.start) {
                        isBlocked = true;
                        break;
                    }
                }
            }

            // Only render blocked slots if they are standard top-of-the-hour slots
            if (isBlocked && !STANDARD_SLOTS.includes(slotStart)) {
                return;
            }

            let h = Math.floor(slotStart / 60);
            let m = slotStart % 60;
            let ampm = h >= 12 ? 'PM' : 'AM';
            let displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            let displayM = m.toString().padStart(2, '0');
            let timeStr = `${displayH}:${displayM} ${ampm}`;

            const btn = document.createElement('button');
            btn.className = 'timeslot-btn';
            btn.textContent = timeStr;
            
            if (isBlocked) {
                btn.disabled = true;
                btn.style.opacity = '0.3';
                btn.style.cursor = 'not-allowed';
                btn.style.background = 'var(--bg-light)';
                btn.style.color = 'var(--text-gray)';
                btn.title = "Time slot unavailable";
            } else {
                hasAvailableSlots = true;
                btn.onclick = () => {
                    timeList.querySelectorAll('.timeslot-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    selectedTime = timeStr;
                    confirmBtn.style.display = 'block';
                    if (window.innerWidth <= 1024) {
                        confirmBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                };
            }
            timeList.appendChild(btn);
        });

        if (!hasAvailableSlots) {
            timeList.innerHTML = '<div style="color:var(--text-gray); padding:1rem 0;">No availability for this date.</div>';
        }
    }
    // Booking Loader Utility
    const showBookingLoader = (message) => {
        // Disabled per user request
    };

    const hideBookingLoader = () => {
        // Disabled per user request
    };

    // Confirm Booking API Call
    const confirmBookingBtn = document.getElementById('confirmBookingBtn');
    if (confirmBookingBtn) {
        confirmBookingBtn.onclick = async () => {
            if (!selectedDate || !selectedTime) return;
            if (!window.Clerk || !window.Clerk.user) {
                window.showToaster("Please log in to book a lesson.", true);
                window.location.href = 'auth.html';
                return;
            }
            
            const isReschedule = window.smjRescheduleMode !== null && window.smjRescheduleMode !== undefined;
            showBookingLoader(isReschedule ? "Updating your schedule... Please wait." : "Confirming your booking... Please wait.");
            
            confirmBookingBtn.disabled = true;
            const originalBtnText = confirmBookingBtn.innerHTML;
            confirmBookingBtn.innerHTML = `<svg viewBox="0 0 24 24" style="animation: spin 1s linear infinite; width: 1.2rem; height: 1.2rem; margin-right: 0.5rem; vertical-align: middle;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Processing...`;
            
            const user = window.Clerk.user;
            const fullName = user.fullName || user.firstName || 'Golfer';
            
            let payload, method;
            
            if (isReschedule) {
                method = 'PUT';
                payload = {
                    id: window.smjRescheduleMode.id,
                    booking_date: new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0],
                    booking_time: selectedTime
                };
            } else {
                method = 'POST';
                payload = {
                    user_id: user.id,
                    user_name: fullName,
                    coach_name: document.getElementById('bookingPlanTitle').textContent.includes('Kids') ? 'Balogun Jacob Micheal' : 'Balogun Jacob Micheal',
                    plan_name: document.getElementById('bookingPlanTitle').textContent,
                    booking_date: new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0],
                    booking_time: selectedTime,
                    payment_method: selectedPaymentMethod || 'cash'
                };
            }

            const submitToBackend = async (finalPayload) => {
                try {
                    // Since this might be tested locally where PHP isn't running via npx serve, 
                    // we simulate the fetch if it fails or returns HTML (like a 404 from serve).
                    const res = await window.apiFetch('api/bookings.php', {
                        method: method,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(finalPayload)
                    });
                    
                    const text = await res.text();
                    let data;
                    try {
                        data = JSON.parse(text);
                    } catch(e) {
                        // Fallback for local testing via npx serve (which doesn't parse PHP)
                        console.warn("PHP API not reachable, falling back to localStorage for testing purposes.");
                        let localBookings = JSON.parse(localStorage.getItem('smj_local_bookings') || '[]');
                        
                        if (isReschedule) {
                            const idx = localBookings.findIndex(b => String(b.id) === String(finalPayload.id));
                            if (idx > -1) {
                                localBookings[idx].booking_date = finalPayload.booking_date;
                                localBookings[idx].booking_time = finalPayload.booking_time;
                            }
                        } else {
                            localBookings.push({...finalPayload, id: Date.now(), status: 'upcoming'});
                        }
                        
                        localStorage.setItem('smj_local_bookings', JSON.stringify(localBookings));
                        data = { status: 'success' };
                    }
                    
                    if (data.status === 'success') {
                        window.showToaster(isReschedule ? "Booking Rescheduled Successfully!" : "Booking Confirmed Successfully!");
                        window.smjRescheduleMode = null; // Clear mode
                        // Do not hide loader while redirecting to make it smooth
                        setTimeout(() => {
                            window.location.href = 'lessons.html';
                        }, 1500);
                    } else {
                        window.showToaster(data.message || "Failed to confirm booking", true);
                        hideBookingLoader();
                        confirmBookingBtn.disabled = false;
                        confirmBookingBtn.innerHTML = originalBtnText;
                    }
                } catch (err) {
                    console.error(err);
                    window.showToaster("Network error occurred.", true);
                    hideBookingLoader();
                    confirmBookingBtn.disabled = false;
                    confirmBookingBtn.innerHTML = originalBtnText;
                }
            };

            // Trigger Paystack if needed
            if (!isReschedule && selectedPaymentMethod === 'paystack') {
                const priceStr = document.getElementById('bookingPlanPrice') ? document.getElementById('bookingPlanPrice').textContent : '0';
                const priceAmount = parseInt(priceStr.replace(/[^0-9]/g, ''), 10) || 0;
                
                if (priceAmount > 0 && typeof PaystackPop !== 'undefined' && window.SMJ_SETTINGS && window.SMJ_SETTINGS.paystack_public_key) {
                    hideBookingLoader(); // hide our loader while Paystack shows
                    
                    const email = user.primaryEmailAddress ? user.primaryEmailAddress.emailAddress : 'golfer@example.com';
                    const handler = PaystackPop.setup({
                        key: window.SMJ_SETTINGS.paystack_public_key,
                        email: email,
                        amount: priceAmount * 100, // in kobo
                        currency: 'NGN',
                        callback: function(response) {
                            showBookingLoader("Verifying payment... Please wait.");
                            payload.paystack_reference = response.reference;
                            submitToBackend(payload);
                        },
                        onClose: function() {
                            window.showToaster("Payment cancelled.", true);
                            confirmBookingBtn.disabled = false;
                            confirmBookingBtn.innerHTML = originalBtnText;
                        }
                    });
                    handler.openIframe();
                } else {
                    // Fallback if price is 0 or Paystack fails to load
                    submitToBackend(payload);
                }
            } else {
                submitToBackend(payload);
            }
        };
    }

    // Mobile Navigation Toggle
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileNav = document.getElementById('mobileNav');
    
    if (hamburgerBtn && mobileNav) {
        hamburgerBtn.addEventListener('click', () => {
            mobileNav.classList.toggle('active');
        });

        // Close menu when clicking a link
        const navLinks = mobileNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileNav.classList.remove('active');
            });
        });
    }

    // Scroll Animation Observer
    const revealElements = document.querySelectorAll('.reveal, .reveal-stagger');
    if (revealElements.length > 0) {
        const revealOptions = {
            threshold: 0.05,
            rootMargin: "0px 0px 0px 0px"
        };

        const revealOnScroll = new IntersectionObserver(function(entries, observer) {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    return;
                } else {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, revealOptions);

        revealElements.forEach(el => {
            revealOnScroll.observe(el);
        });
    }
});

// Global Toaster Utility
window.showToaster = function(message, isError = false) {
    const toaster = document.createElement('div');
    toaster.className = 'toaster';
    if (isError) {
        toaster.style.borderColor = '#ef4444';
        toaster.style.boxShadow = '8px 8px 0 #ef4444';
    }
    
    toaster.innerHTML = `
        <svg class="toaster-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            ${isError 
                ? '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'
                : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
            }
        </svg>
        <div class="toaster-content">${message}</div>
    `;
    
    document.body.appendChild(toaster);
    
    // Animate in
    setTimeout(() => {
        toaster.classList.add('show');
    }, 10);
    
    // Animate out
    setTimeout(() => {
        toaster.classList.remove('show');
        setTimeout(() => toaster.remove(), 300);
    }, 4000);
};

// Global Logout Modal Utility
window.showLogoutModal = function(onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'logout-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'logout-modal';
    
    modal.innerHTML = `
        <h3>Log Out</h3>
        <p>Are you sure you want to log out of your session?</p>
        <div class="logout-modal-actions">
            <button class="btn btn-outline" id="cancelLogout">Cancel</button>
            <button class="btn btn-danger" id="confirmLogout">Log Out</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Animate in
    setTimeout(() => overlay.classList.add('show'), 10);
    
    const close = () => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 300);
    };
    
    document.getElementById('cancelLogout').onclick = close;
    
    document.getElementById('confirmLogout').onclick = async () => {
        const btn = document.getElementById('confirmLogout');
        btn.classList.add('loading');
        await onConfirm();
        close();
    };
    
    // Close on overlay click
    overlay.onclick = (e) => {
        if(e.target === overlay) close();
    };
};

// Global Clerk Listener for Nav Update
window.addEventListener('load', () => {
    const checkClerk = setInterval(() => {
        // Clerk is fully loaded when window.Clerk.client exists
        if (window.Clerk && window.Clerk.client) {
            clearInterval(checkClerk);
            
            const updateNav = (user) => {
                const navLoginBtns = document.querySelectorAll('.nav-login-btn');
                const dropdownContainers = document.querySelectorAll('.user-dropdown-container');
                const userAvatars = document.querySelectorAll('.user-avatar');
                const navUserNames = document.querySelectorAll('.nav-user-name');
                const navLogoutBtns = document.querySelectorAll('.nav-logout-btn');
                const landingLinks = document.querySelectorAll('.nav > a:not(.nav-login-btn)');

                if (user) {
                    document.body.classList.add('logged-in');
                    const fullName = user.fullName || user.firstName || 'Golfer';
                    let initials = 'G';
                    if (user.lastName && user.firstName) {
                        initials = (user.lastName[0] + user.firstName[0]).toUpperCase();
                    } else if (user.firstName && user.lastName) {
                        initials = (user.lastName[0] + user.firstName[0]).toUpperCase();
                    } else if (user.lastName) {
                        initials = user.lastName[0].toUpperCase();
                    } else if (user.firstName) {
                        initials = user.firstName[0].toUpperCase();
                    } else if (user.fullName) {
                        initials = user.fullName.substring(0, 2).toUpperCase();
                    }
                    
                    // Hide Log In and Landing Links
                    navLoginBtns.forEach(btn => btn.style.display = 'none');
                    landingLinks.forEach(link => link.style.display = 'none');
                    
                    // Show Dropdown
                    dropdownContainers.forEach(container => {
                        container.style.display = 'inline-block';
                        
                        const toggle = container.querySelector('.user-dropdown-toggle');
                        const menu = container.querySelector('.user-dropdown-menu');
                        
                        // Setup toggle listener
                        toggle.onclick = (e) => {
                            e.stopPropagation();
                            const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
                            
                            // Close all other dropdowns
                            document.querySelectorAll('.user-dropdown-toggle').forEach(t => t.setAttribute('aria-expanded', 'false'));
                            document.querySelectorAll('.user-dropdown-menu').forEach(m => m.classList.remove('show'));
                            
                            if (!isExpanded) {
                                toggle.setAttribute('aria-expanded', 'true');
                                menu.classList.add('show');
                            }
                        };
                    });
                    
                    // Populate Details
                    userAvatars.forEach(el => el.textContent = initials);
                    navUserNames.forEach(el => el.textContent = fullName);
                    
                    // Setup Log Out Button
                    navLogoutBtns.forEach(btn => {
                        btn.onclick = async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.showLogoutModal(async () => {
                                await window.Clerk.signOut();
                                window.showToaster("Logged out successfully");
                                setTimeout(() => window.location.reload(), 1000);
                            });
                        };
                    });

                    // AUTO-RESUME BOOKING
                    const bookingModal = document.getElementById('bookingModal');
                    if (bookingModal) {
                        const pendingBookingStr = localStorage.getItem('smj_pending_booking');
                        if (pendingBookingStr) {
                            try {
                                const pendingBooking = JSON.parse(pendingBookingStr);
                                localStorage.removeItem('smj_pending_booking');
                                
                                // Populate step3-booking details
                            const titleEl = document.getElementById('bookingPlanTitle');
                            if (titleEl) titleEl.textContent = pendingBooking.title;
                            const priceEl = document.getElementById('bookingPlanPrice');
                            if (priceEl) priceEl.textContent = pendingBooking.price;
                            const durationEl = document.getElementById('bookingPlanDuration');
                            if (durationEl) durationEl.textContent = pendingBooking.duration;
                            const perksEl = document.getElementById('bookingPlanPerks');
                            if (perksEl) perksEl.textContent = pendingBooking.perks;
                            
                            const btnNewbie = document.getElementById('btnNewbie');
                            const btnRegular = document.getElementById('btnRegular');
                            const btnKids = document.getElementById('btnKids');

                            if (pendingBooking.category === 'newbie') {
                                if (btnNewbie) btnNewbie.classList.add('selected');
                                if (btnRegular) btnRegular.classList.remove('selected');
                                if (btnKids) btnKids.classList.remove('selected');
                            } else if (pendingBooking.category === 'kids') {
                                if (btnKids) btnKids.classList.add('selected');
                                if (btnNewbie) btnNewbie.classList.remove('selected');
                                if (btnRegular) btnRegular.classList.remove('selected');
                            } else {
                                if (btnRegular) btnRegular.classList.add('selected');
                                if (btnNewbie) btnNewbie.classList.remove('selected');
                                if (btnKids) btnKids.classList.remove('selected');
                            }
                            
                            const bookingModal = document.getElementById('bookingModal');
                            if (bookingModal) {
                                bookingModal.classList.add('active');
                                const step1 = document.getElementById('step1');
                                if (step1) step1.style.display = 'none';
                                const step25Payment = document.getElementById('step2.5-payment');
                                if (step25Payment) step25Payment.style.display = 'block';
                                
                                const modalContent = document.querySelector('.modal-content');
                                if (modalContent) modalContent.classList.remove('modal-regular-wide');
                                

                                if (window.showToaster) {
                                    window.showToaster("Welcome back! Your booking has been restored.");
                                }
                            }
                        } catch (err) {
                            console.error('Failed to parse pending booking', err);
                        }
                    }
                    } // close if (bookingModal)
                } else {
                    document.body.classList.remove('logged-in');
                    navLoginBtns.forEach(btn => btn.style.display = 'inline-block');
                    landingLinks.forEach(link => link.style.display = 'inline-block');
                    dropdownContainers.forEach(container => container.style.display = 'none');
                }
                
                const authSections = document.querySelectorAll('.nav-auth-section');
                authSections.forEach(section => {
                    section.style.opacity = '1';
                    section.style.pointerEvents = 'auto';
                });
                
                const mobileNav = document.getElementById('mobileNav');
                if (mobileNav) {
                    mobileNav.style.opacity = '1';
                }
            };

            // Global click to close dropdowns
            document.addEventListener('click', () => {
                document.querySelectorAll('.user-dropdown-toggle').forEach(t => t.setAttribute('aria-expanded', 'false'));
                document.querySelectorAll('.user-dropdown-menu').forEach(m => m.classList.remove('show'));
            });
            // Call immediately with current state
            updateNav(window.Clerk.user);

            // Listen for future changes
            window.Clerk.addListener((payload) => {
                updateNav(payload.user);
            });
        }
    }, 100);
});
