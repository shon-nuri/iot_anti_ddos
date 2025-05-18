import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def send_telegram(message):
    """Send message to Telegram"""
    try:
        token = settings.TELEGRAM_TOKEN
        chat_id = settings.TELEGRAM_CHAT_ID
        
        logger.info(f'Sending Telegram message: {message}')
        logger.info(f'Using token: {token[:4]}...{token[-4:]}')
        logger.info(f'To chat ID: {chat_id}')
        
        url = f'https://api.telegram.org/bot{token}/sendMessage'
        data = {
            'chat_id': chat_id,
            'text': message,
            'parse_mode': 'HTML'
        }
        
        response = requests.post(url, data=data, timeout=5)
        if not response.ok:
            logger.error(f"Telegram API error: {response.status_code} - {response.text}")
            return False
            
        logger.info('Telegram message sent successfully')
        return True
    except Exception as e:
        logger.error(f"Failed to send telegram message: {str(e)}")
        return False