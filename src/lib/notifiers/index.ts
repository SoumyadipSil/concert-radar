import { getNotifier, registerNotifier } from './registry';
import { EmailNotifier } from './email';
import { TelegramNotifier } from './telegram';

if (!getNotifier('email')) {
  registerNotifier(new EmailNotifier());
}

if (!getNotifier('telegram')) {
  registerNotifier(new TelegramNotifier());
}

export { EmailNotifier, TelegramNotifier };
