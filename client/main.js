// API Base URL - matches your backend port 50002
const API_BASE_URL = 'https://rafia-vehicle-system.onrender.com/api';

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    initializeApp();
    
    // Form elements
    const registerForm = document.getElementById('registerForm');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    
    // Modal elements
    const successModal = document.getElementById('successModal');
    const successOkBtn = document.getElementById('successOkBtn');
    
    // Initialize year dropdown
    populateYearDropdown();
    
    // Event listeners
    registerForm.addEventListener('submit', handleFormSubmit);
    passwordInput.addEventListener('input', updatePasswordStrength);
    confirmPasswordInput.addEventListener('input', validatePasswordMatch);
    successOkBtn.addEventListener('click', closeSuccessModal);
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === successModal) {
            closeSuccessModal();
        }
    });

    function initializeApp() {
        console.log('Vehicle Access System initialized');
        // Test backend connection on startup
        testBackendConnection();
    }

    async function testBackendConnection() {
        try {
            const response = await fetch(`${API_BASE_URL}/health`);
            const data = await response.json();
            
            if (data.status === 'OK') {
                console.log('✅ Backend connection successful');
                showStatusMessage('Connected to server successfully', 'success');
            } else {
                console.warn('⚠️ Backend health check failed');
                showStatusMessage('Server connection issue', 'error');
            }
        } catch (error) {
            console.error('❌ Backend connection failed:', error);
            showStatusMessage('Cannot connect to server. Please make sure the backend is running on port 50001.', 'error');
        }
    }

    function showStatusMessage(message, type) {
        // Remove existing status messages
        const existingMessage = document.querySelector('.status-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const statusDiv = document.createElement('div');
        statusDiv.className = `status-message status-${type}`;
        statusDiv.textContent = message;
        
        // Insert after auth header
        const authHeader = document.querySelector('.auth-header');
        authHeader.parentNode.insertBefore(statusDiv, authHeader.nextSibling);

        // Auto-remove success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.remove();
            }, 5000);
        }
    }

    function populateYearDropdown() {
        const yearSelect = document.getElementById('vehicleYear');
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 30;
        
        // Clear existing options except the first one
        while (yearSelect.options.length > 1) {
            yearSelect.remove(1);
        }
        
        for (let year = currentYear; year >= startYear; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }
    }

    function updatePasswordStrength() {
        const password = passwordInput.value;
        let strength = 0;
        let message = 'Password strength';
        let color = '#e74c3c';
        
        // Calculate strength
        if (password.length >= 8) strength += 25;
        if (/[A-Z]/.test(password)) strength += 25;
        if (/[0-9]/.test(password)) strength += 25;
        if (/[^A-Za-z0-9]/.test(password)) strength += 25;
        
        // Update visual indicator
        strengthBar.style.background = `linear-gradient(90deg, #e74c3c 0%, #f39c12 ${strength/2}%, #27ae60 ${strength}%)`;
        
        // Update text and color
        if (strength <= 25) {
            message = 'Weak';
            color = '#e74c3c';
        } else if (strength <= 50) {
            message = 'Fair';
            color = '#f39c12';
        } else if (strength <= 75) {
            message = 'Good';
            color = '#f1c40f';
        } else {
            message = 'Strong';
            color = '#27ae60';
        }
        
        strengthText.textContent = message;
        strengthText.style.color = color;
    }

    function validatePasswordMatch() {
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        if (confirmPassword && password !== confirmPassword) {
            confirmPasswordInput.style.borderColor = '#e74c3c';
            confirmPasswordInput.setCustomValidity('Passwords do not match');
        } else {
            confirmPasswordInput.style.borderColor = '#27ae60';
            confirmPasswordInput.setCustomValidity('');
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        
        // Validate form
        if (!registerForm.checkValidity()) {
            showFormErrors();
            return;
        }
        
        // Validate password match
        if (passwordInput.value !== confirmPasswordInput.value) {
            alert('Passwords do not match!');
            return;
        }
        
        // Collect and submit form data
        const formData = collectFormData();
        await submitFormToBackend(formData);
    }

    function collectFormData() {
        return {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim(),
            address: document.getElementById('address').value.trim(),
            town: document.getElementById('town').value.trim(),
            country: document.getElementById('country').value,
            contact: document.getElementById('contact').value.trim(),
            userType: document.getElementById('userType').value,
            password: document.getElementById('password').value,
            licensePlate: document.getElementById('licensePlate').value.trim(),
            chassisNumber: document.getElementById('chassisNumber').value.trim(),
            vehicleMake: document.getElementById('vehicleMake').value,
            vehicleModel: document.getElementById('vehicleModel').value.trim(),
            vehicleYear: parseInt(document.getElementById('vehicleYear').value),
            vehicleColor: document.getElementById('vehicleColor').value
        };
    }

    function showFormErrors() {
        const invalidFields = registerForm.querySelectorAll(':invalid');
        invalidFields.forEach(field => {
            field.style.borderColor = '#e74c3c';
            // Show validation message
            field.reportValidity();
        });
        
        // Focus on first invalid field
        if (invalidFields.length > 0) {
            invalidFields[0].focus();
        }
    }

    async function submitFormToBackend(formData) {
        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        try {
            // Show loading state
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
            submitBtn.disabled = true;
            registerForm.classList.add('loading');

            console.log('Submitting data to backend...');

            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Registration failed with status ${response.status}`);
            }

            // Show success modal
            showSuccessModal(
                'Registration Successfully',
                ''
            );
            
            console.log('Registration successful:', data);

        } catch (error) {
            console.error('Registration error:', error);
            
            // Show user-friendly error message
            let errorMessage = error.message || 'Registration failed. Please try again.';
            if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
                errorMessage = 'Cannot connect to server. Please make sure the backend is running on port 50001.';
            }
            
            showStatusMessage(errorMessage, 'error');
            
        } finally {
            // Restore button state
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            registerForm.classList.remove('loading');
        }
    }

    function resetPasswordStrength() {
        strengthBar.style.background = '#e1e5e9';
        strengthText.textContent = 'Password strength';
        strengthText.style.color = '#666';
    }

    function showSuccessModal(title, message) {
        document.getElementById('successTitle').textContent = title;
        document.getElementById('successMessage').textContent = message;
        successModal.style.display = 'block';
        
        // Reset form on successful submission
        registerForm.reset();
        resetPasswordStrength();
        populateYearDropdown(); // Re-populate years after reset
    }

    function closeSuccessModal() {
        successModal.style.display = 'none';
        // Optional: Redirect to login page or clear form
    }

    // Additional utility functions
    function formatLicensePlate(input) {
        const value = input.value.replace(/\s/g, '').toUpperCase();
        if (value.length > 3) {
            input.value = value.slice(0, 3) + ' ' + value.slice(3, 6);
        }
    }

    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Real-time validation for email
    const emailInput = document.getElementById('email');
    emailInput.addEventListener('blur', function() {
        if (this.value && !validateEmail(this.value)) {
            this.style.borderColor = '#e74c3c';
            this.setCustomValidity('Please enter a valid email address');
        } else {
            this.style.borderColor = '#e1e5e9';
            this.setCustomValidity('');
        }
    });

    // License plate formatting
    const licensePlateInput = document.getElementById('licensePlate');
    licensePlateInput.addEventListener('input', function() {
        formatLicensePlate(this);
    });

    // Chassis number formatting (VIN) - uppercase and remove spaces
    const chassisNumberInput = document.getElementById('chassisNumber');
    chassisNumberInput.addEventListener('input', function() {
        this.value = this.value.toUpperCase().replace(/\s/g, '');
    });

    // Real-time validation for all required fields
    const requiredFields = registerForm.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        field.addEventListener('blur', function() {
            if (this.value && this.checkValidity()) {
                this.style.borderColor = '#27ae60';
            } else if (!this.value) {
                this.style.borderColor = '#e1e5e9';
            }
        });
    });
});
