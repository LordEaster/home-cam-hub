import { AxiosError } from 'axios';
import { toast } from 'sonner';

/**
 * Error response structure from backend
 */
export interface ApiErrorResponse {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    
    if (data?.message) {
      if (Array.isArray(data.message)) {
        return data.message.join(', ');
      }
      return data.message;
    }
    
    if (error.message) {
      return error.message;
    }
    
    return 'An unexpected error occurred';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Show error toast notification
 */
export function showErrorToast(error: unknown, defaultMessage?: string): void {
  const message = defaultMessage || getErrorMessage(error);
  toast.error(message);
}

/**
 * Show success toast notification
 */
export function showSuccessToast(message: string): void {
  toast.success(message);
}

/**
 * Show warning toast notification
 */
export function showWarningToast(message: string): void {
  toast.warning(message);
}

/**
 * Show info toast notification
 */
export function showInfoToast(message: string): void {
  toast.info(message);
}

/**
 * Handle API errors with appropriate toast notifications
 */
export function handleApiError(error: unknown, context?: string): void {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    
    let message = getErrorMessage(error);
    
    if (context) {
      message = `${context}: ${message}`;
    }
    
    switch (status) {
      case 400:
        toast.error(message);
        break;
      case 401:
        // Don't show toast for 401, handled by axios interceptor
        break;
      case 403:
        toast.error('You do not have permission to perform this action');
        break;
      case 404:
        toast.error(message || 'Resource not found');
        break;
      case 409:
        toast.error(message || 'This action conflicts with existing data');
        break;
      case 500:
        toast.error('Server error. Please try again later');
        break;
      default:
        toast.error(message);
    }
  } else {
    toast.error(getErrorMessage(error));
  }
}
