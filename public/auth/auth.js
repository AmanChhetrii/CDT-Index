// Common Auth JavaScript Functions

// Particle configuration for all auth pages
const authParticleConfig = {
    "particles": {
        "number": {
            "value": 40,
            "density": {
                "enable": true,
                "value_area": 800
            }
        },
        "color": {
            "value": "#FFFFFF"
        },
        "shape": {
            "type": "circle"
        },
        "opacity": {
            "value": 0.2,
            "random": true
        },
        "size": {
            "value": 1.5,
            "random": true
        },
        "line_linked": {
            "enable": false
        },
        "move": {
            "enable": true,
            "speed": 1,
            "direction": "none",
            "random": true,
            "straight": false,
            "out_mode": "out",
            "bounce": false
        }
    },
    "interactivity": {
        "detect_on": "canvas",
        "events": {
            "onhover": {
                "enable": false
            },
            "onclick": {
                "enable": false
            },
            "resize": true
        }
    },
    "retina_detect": true
};

// Initialize particles on all auth pages
document.addEventListener('DOMContentLoaded', function() {
    if (window.particlesJS && document.getElementById('particles-auth')) {
        particlesJS('particles-auth', authParticleConfig);
    }
});

// Common validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password && password.length >= 6;
}

function validateSignupPassword(password) {
    return password && password.length >= 8;
}

function showFieldError(field, errorElement, message) {
    field.classList.add('error');
    field.classList.remove('valid', 'success');
    if (message) errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function showFieldSuccess(field, errorElement) {
    field.classList.remove('error');
    field.classList.add('valid');
    errorElement.style.display = 'none';
}

function hideFieldError(field, errorElement) {
    field.classList.remove('error', 'valid', 'success');
    errorElement.style.display = 'none';
}

function resetAllErrors() {
    document.querySelectorAll('.form-control').forEach(el => el.classList.remove('error', 'valid', 'success'));
    document.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.success-message').forEach(el => el.style.display = 'none');
}

// Password strength checker for signup page
function initPasswordStrength() {
    const passwordField = document.getElementById('password');
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    if (!passwordField || !strengthFill || !strengthText) return;
    
    passwordField.addEventListener('input', function() {
        const password = this.value;
        let strength = 0;
        
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        
        strengthFill.className = 'strength-fill';
        
        if (password.length === 0) {
            strengthText.textContent = 'Password strength';
            strengthText.style.color = 'rgba(255, 255, 255, 0.6)';
        } else if (strength <= 2) {
            strengthFill.classList.add('strength-weak');
            strengthText.textContent = 'Weak password';
            strengthText.style.color = '#ff4757';
        } else if (strength <= 4) {
            strengthFill.classList.add('strength-medium');
            strengthText.textContent = 'Medium password';
            strengthText.style.color = '#ffa502';
        } else {
            strengthFill.classList.add('strength-strong');
            strengthText.textContent = 'Strong password';
            strengthText.style.color = '#2ed573';
        }
    });
}

// Real-time password confirmation validation
function initPasswordConfirmation() {
    const confirmPasswordField = document.getElementById('confirmPassword');
    const passwordField = document.getElementById('password');
    const errorMsg = document.getElementById('confirmPasswordError');
    
    if (!confirmPasswordField || !passwordField || !errorMsg) return;
    
    confirmPasswordField.addEventListener('input', function() {
        const password = passwordField.value;
        const confirmPassword = this.value;
        
        if (confirmPassword && password !== confirmPassword) {
            this.classList.add('error');
            this.classList.remove('valid');
            errorMsg.style.display = 'block';
        } else if (confirmPassword && password === confirmPassword) {
            this.classList.remove('error');
            this.classList.add('valid');
            errorMsg.style.display = 'none';
        }
    });
}

// Login form validation
function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const emailError = document.getElementById('emailError');
        const passwordError = document.getElementById('passwordError');
        
        resetAllErrors();
        let isValid = true;
        
        // Validate email
        if (!email.value || !validateEmail(email.value)) {
            showFieldError(email, emailError, 'Please enter a valid email address');
            isValid = false;
        }
        
        // Validate password
        if (!validatePassword(password.value)) {
            const message = password.value.length < 6 ? 'Password must be at least 6 characters' : 'Password is required';
            showFieldError(password, passwordError, message);
            isValid = false;
        }
        
        if (isValid) {
            // Show loading state
            const submitBtn = document.querySelector('.auth-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing In...';
        } else {
            e.preventDefault();
        }
    });
}

// Signup form validation
function initSignupForm() {
    const form = document.getElementById('signupForm');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        const firstName = document.getElementById('firstName');
        const lastName = document.getElementById('lastName');
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirmPassword');
        const terms = document.getElementById('terms');
        
        resetAllErrors();
        let isValid = true;
        
        // Validate first name
        if (!firstName.value.trim()) {
            showFieldError(firstName, document.getElementById('firstNameError'));
            isValid = false;
        } else {
            showFieldSuccess(firstName, document.getElementById('firstNameError'));
        }
        
        // Validate last name
        if (!lastName.value.trim()) {
            showFieldError(lastName, document.getElementById('lastNameError'));
            isValid = false;
        } else {
            showFieldSuccess(lastName, document.getElementById('lastNameError'));
        }
        
        // Validate email
        if (!email.value || !validateEmail(email.value)) {
            showFieldError(email, document.getElementById('emailError'));
            isValid = false;
        } else {
            showFieldSuccess(email, document.getElementById('emailError'));
        }
        
        // Validate password
        if (!validateSignupPassword(password.value)) {
            showFieldError(password, document.getElementById('passwordError'));
            isValid = false;
        } else {
            showFieldSuccess(password, document.getElementById('passwordError'));
        }
        
        // Validate confirm password
        if (!confirmPassword.value || confirmPassword.value !== password.value) {
            showFieldError(confirmPassword, document.getElementById('confirmPasswordError'));
            isValid = false;
        } else {
            showFieldSuccess(confirmPassword, document.getElementById('confirmPasswordError'));
        }
        
        // Validate terms
        if (!terms.checked) {
            alert('Please accept the Terms of Service and Privacy Policy to continue.');
            isValid = false;
        }
        
        if (isValid) {
            // Show loading state
            const submitBtn = document.querySelector('.auth-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';
        } else {
            e.preventDefault();
        }
    });
}

// Forgot password form validation
function initForgotPasswordForm() {
    const form = document.getElementById('forgotPasswordForm');
    if (!form) return;
    
    // Email validation on input
    const emailField = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const emailSuccess = document.getElementById('emailSuccess');
    
    if (emailField && emailError) {
        emailField.addEventListener('input', function() {
            const email = this.value;
            
            if (email && validateEmail(email)) {
                this.classList.remove('error');
                this.classList.add('success');
                emailError.style.display = 'none';
                if (emailSuccess) emailSuccess.style.display = 'block';
            } else if (email) {
                this.classList.remove('success');
                this.classList.add('error');
                emailError.style.display = 'block';
                if (emailSuccess) emailSuccess.style.display = 'none';
            } else {
                this.classList.remove('error', 'success');
                emailError.style.display = 'none';
                if (emailSuccess) emailSuccess.style.display = 'none';
            }
        });
    }
    
    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email');
        
        if (!email.value || !validateEmail(email.value)) {
            showFieldError(email, emailError, 'Please enter a valid email address');
            return;
        }
        
        // Simulate sending email
        const submitBtn = document.querySelector('.auth-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        
        setTimeout(() => {
            // Hide form state and show success state
            const formState = document.querySelector('.form-state');
            const successState = document.getElementById('successState');
            const emailSent = document.getElementById('emailSent');
            
            if (formState) formState.classList.add('hidden');
            if (successState) successState.classList.add('active');
            if (emailSent) emailSent.textContent = email.value;
            
            // Start resend timer
            startResendTimer();
        }, 1500);
    });
}

// Resend timer functionality for forgot password
let resendTimer = null;
let resendCount = 60;

function startResendTimer() {
    const resendBtn = document.getElementById('resendBtn');
    const timerElement = document.getElementById('resendTimer');
    
    if (!resendBtn || !timerElement) return;
    
    resendBtn.disabled = true;
    resendCount = 60;
    
    resendTimer = setInterval(() => {
        resendCount--;
        timerElement.textContent = `Resend available in ${resendCount} seconds`;
        
        if (resendCount <= 0) {
            clearInterval(resendTimer);
            resendBtn.disabled = false;
            resendBtn.textContent = 'Resend Email';
            timerElement.textContent = '';
        }
    }, 1000);
}

function resendEmail() {
    const resendBtn = document.getElementById('resendBtn');
    if (resendBtn) {
        resendBtn.textContent = 'Sending...';
        
        setTimeout(() => {
            alert('Password reset email sent successfully!');
            startResendTimer();
        }, 1000);
    }
}

// Enhanced form field interactions
function initFormFieldInteractions() {
    document.querySelectorAll('.form-control').forEach(input => {
        // Add focus animations
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });
    });
}

// Card entrance animation
// Better card entrance animation
function initCardAnimation() {
    // Set initial state immediately when DOM is ready (before page is visible)
    document.addEventListener('DOMContentLoaded', function() {
        const authCard = document.querySelector('.auth-card');
        if (authCard) {
            authCard.style.opacity = '0';
            authCard.style.transform = 'translateY(30px)';
        }
    });
    
    // Trigger animation after page is fully loaded
    window.addEventListener('load', function() {
        const authCard = document.querySelector('.auth-card');
        if (authCard) {
            setTimeout(() => {
                authCard.style.transition = 'all 0.6s ease';
                authCard.style.opacity = '1';
                authCard.style.transform = 'translateY(0)';
            }, 100);
        }
    });
}

// Initialize all common functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize components based on what's available on the page
    initPasswordStrength();
    initPasswordConfirmation();
    initLoginForm();
    initSignupForm();
    initForgotPasswordForm();
    initFormFieldInteractions();
    initCardAnimation();
});

// Make resendEmail function available globally for onclick handlers
window.resendEmail = resendEmail;