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
      const response = await apiClient.post('/auth/login', { email, password });
      
      if (response.access_token) {
        this.token = response.access_token;
        this.user = response.user;
        
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
      const response = await apiClient.get('/auth/validate');
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
