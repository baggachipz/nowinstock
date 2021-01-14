# NowInStock

Tracker to send SMS alerts instantly when an out-of-stock item returns in stock at online retailers. Uses your Twilio account to send text messages and Puppeteer to check the retailer pages.

Currently-supported online retailers:
- Amazon
- Costco
- Best Buy
- Target
- GameStop

## Getting Started

### Prerequisites

- NodeJS (> v10.x)
- NPM
- A [Twilio account](https://www.twilio.com/try-twilio) (trial is fine), and create a phone number in their dashboard to send SMS messages.
- Chromium/Chrome installed on the target environment (headless is fine)
- Technical inclination and ability to work a bit from a command line

### Setup

1. Clone this project on a computer which can keep it running all the time (A VPS or a Raspberry Pi is a good idea).
2. Go into the directory of the project and run `npm install`.
3. run `node index.js` to start it up. The first time you run it, you will be prompted for your Twilio credentials, your phone number, and the first product page you want to track. 

That's it! If you want to add additional products, you can edit the generated config.json file to add to the "items" list. It is pretty self-explanatory. By default, the script checks every 2 minutes. Change that by adding a `interval` property to `config.json` to specify milliseconds between runs. For example, adding `"interval": 60000` would tell the script to run every minute (60 seconds, AKA 60000 milliseconds).

You probably also want to set this script up to run indefinitely on your server without having a terminal window open. [PM2](https://www.npmjs.com/package/pm2) is an excellent tool for this.

## Development

To develop locally, follow the steps above but run `npm run dev` to start a server which watches for changes and reloads automatically.
