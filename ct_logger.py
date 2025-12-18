import logging
import sys
from pathlib import Path
from datetime import datetime
from logging.handlers import RotatingFileHandler
import json

class CTStudioLogger:
    """Centralized logging system for CT Studio application"""
    
    def __init__(self, name: str = "ct_studio", log_dir: str = "logs"):
        self.name = name
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
        
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        
        # Clear existing handlers
        self.logger.handlers.clear()
        
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup multiple log handlers for different purposes"""
        
        # 1. Console Handler (INFO and above)
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(message)s',
            datefmt='%H:%M:%S'
        )
        console_handler.setFormatter(console_formatter)
        
        # 2. File Handler - All logs
        all_log_file = self.log_dir / f"{self.name}.log"
        file_handler = RotatingFileHandler(
            all_log_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(logging.DEBUG)
        file_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        
        # 3. Error Handler - Only errors
        error_log_file = self.log_dir / f"{self.name}_errors.log"
        error_handler = RotatingFileHandler(
            error_log_file,
            maxBytes=10*1024*1024,
            backupCount=5,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(file_formatter)
        
        # Add handlers
        self.logger.addHandler(console_handler)
        self.logger.addHandler(file_handler)
        self.logger.addHandler(error_handler)
    
    def get_logger(self):
        """Get the configured logger instance"""
        return self.logger
    
    # Convenience methods
    def debug(self, msg, **kwargs):
        self.logger.debug(msg, extra=kwargs)
    
    def info(self, msg, **kwargs):
        self.logger.info(msg, extra=kwargs)
    
    def warning(self, msg, **kwargs):
        self.logger.warning(msg, extra=kwargs)
    
    def error(self, msg, **kwargs):
        self.logger.error(msg, extra=kwargs)
    
    def critical(self, msg, **kwargs):
        self.logger.critical(msg, extra=kwargs)
    
    def log_order_creation(self, order_id: str, customer_id: str, total: float, items: list):
        """Structured logging for order creation"""
        self.logger.info(
            f"Order created: {order_id}",
            extra={
                'event': 'order_created',
                'order_id': order_id,
                'customer_id': customer_id,
                'total': total,
                'item_count': len(items),
                'items': items
            }
        )
    
    def log_error(self, error: Exception, context: dict = None):
        """Structured error logging with context"""
        self.logger.error(
            f"Error occurred: {type(error).__name__}: {str(error)}",
            extra={
                'event': 'error',
                'error_type': type(error).__name__,
                'error_message': str(error),
                'context': context or {}
            },
            exc_info=True
        )
    
    def log_api_call(self, sheet_name: str, operation: str, duration: float = None):
        """Log Google Sheets API calls"""
        msg = f"Google Sheets: {operation} on {sheet_name}"
        if duration:
            msg += f" (took {duration:.2f}s)"
        
        self.logger.debug(
            msg,
            extra={
                'event': 'api_call',
                'sheet_name': sheet_name,
                'operation': operation,
                'duration': duration
            }
        )


# Global logger instance
_logger_instance = None

def get_logger(name: str = "ct_studio") -> CTStudioLogger:
    """Get or create the global logger instance"""
    global _logger_instance
    if _logger_instance is None:
        _logger_instance = CTStudioLogger(name)
    return _logger_instance