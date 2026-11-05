/**
 * Prints a fresh pair of Web Push keys. Paste them into .env:
 *   npm run vapid
 * Generate once. Changing them later means every device has to turn notifications on again.
 */
import webpush from "web-push";

const k = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${k.privateKey}`);
