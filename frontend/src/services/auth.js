// src/services/auth.js
import apiClient from './api';

/**
 * Authentication service for handling user login, logout, and session management
 */
class AuthService {
  constructor() {
    this.token = localStorage.getItem('auth_token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.token;
  }

  /**
   * Get current user information
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Get auth token
   */
  getToken() {
    return this.token;
  }

  /**
   * Authenticate user with credentials
   */
  async login(email, password) {
    try {
      // Create URLSearchParams - this is the proper format for sending form data
      const formData = new URLSearchParams();
      formData.append('username', email); // Note: OAuth2 form uses 'username'
      formData.append('password', password);

      // Make the request with application/x-www-form-urlencoded content type       
      const response = await fetch(`${apiClient.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });
      
      // Handle non-2xx responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to login');
      }
      
      // Parse the successful response
      const data = await response.json();
            
      
      if (data.access_token) {
        this.token = data.access_token;
        this.user = data.user;      
        
        // Store auth data in localStorage
        localStorage.setItem('auth_token', this.token);
        localStorage.setItem('user', JSON.stringify(this.user));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Log out current user
   */
  logout() {
    this.token = null;
    this.user = null;
    
    // Clear auth data from localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    
    // Redirect to login page
    window.location.href = '/login';
  }

  /**
   * Check authentication status and refresh if needed
   */
  async checkAuthStatus() {
    if (!this.isAuthenticated()) {
      return false;
    }
    
    try {
      // Validate token with backend
      const response = await apiClient.get('/api/auth/validate');
      return !!response.valid;
    } catch (error) {
      console.error('Auth validation error:', error);
      this.logout();
      return false;
    }
  }
}

const authService = new AuthService();
export default authService;
